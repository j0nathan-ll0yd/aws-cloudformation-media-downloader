import {Context} from 'aws-lambda'
import {fetchVideoInfo, chooseVideoFormat, streamVideoToS3} from '../../../lib/vendor/YouTube'
import {StartFileUploadParams, DynamoDBFile} from '../../../types/main'
import {FileStatus} from '../../../types/enums'
import {logDebug, logInfo, putMetric, lambdaErrorResponse, response} from '../../../util/lambda-helpers'
import {assertIsError} from '../../../util/transformers'
import {UnexpectedError, CookieExpirationError, providerFailureErrorMessage} from '../../../util/errors'
import {upsertFile} from '../../../util/shared'
import {createVideoDownloadFailureIssue, createCookieExpirationIssue} from '../../../util/github-helpers'
import {withXRay, getSegment} from '../../../lib/vendor/AWS/XRay'

// ElectroDB entity table configuration
const {DynamoDBTableFiles} = process.env
void DynamoDBTableFiles

/**
 * Downloads a YouTube video and uploads it to S3
 * @param event - Contains the fileId to download
 * @param context - AWS Lambda context
 * @notExported
 */
export const handler = withXRay(async (event: StartFileUploadParams, context: Context, {traceId: _traceId}) => {
  logInfo('event <=', event)
  const fileId = event.fileId
  const fileUrl = `https://www.youtube.com/watch?v=${fileId}`

  try {
    const segment = getSegment()

    logDebug('fetchVideoInfo <=', fileUrl)
    const subsegmentFetch = segment?.addNewSubsegment('yt-dlp-fetch-info')
    const videoInfo = await fetchVideoInfo(fileUrl)
    if (subsegmentFetch) {
      subsegmentFetch.addAnnotation('videoId', videoInfo.id)
      subsegmentFetch.addMetadata('videoUrl', fileUrl)
      subsegmentFetch.close()
    }
    logDebug('fetchVideoInfo =>', videoInfo)

    const selectedFormat = chooseVideoFormat(videoInfo)
    logDebug('chooseVideoFormat =>', selectedFormat)

    const fileName = `${videoInfo.id}.${selectedFormat.ext}`
    const bucket = process.env.Bucket as string

    if (!bucket) {
      throw new UnexpectedError(providerFailureErrorMessage)
    }

    const dynamoItem: DynamoDBFile = {
      fileId: videoInfo.id,
      key: fileName,
      size: selectedFormat.filesize || 0,
      availableAt: new Date().getTime() / 1000,
      authorName: videoInfo.uploader || 'Unknown',
      authorUser: (videoInfo.uploader || 'unknown').toLowerCase().replace(/\s+/g, '_'),
      title: videoInfo.title,
      description: videoInfo.description || '',
      publishDate: videoInfo.upload_date || new Date().toISOString(),
      contentType: 'video/mp4',
      status: FileStatus.PendingDownload
    }

    logDebug('upsertFile <=', dynamoItem)
    await upsertFile(dynamoItem)
    logDebug('upsertFile =>')

    logDebug('streamVideoToS3 <=', {url: fileUrl, bucket, key: fileName})
    const subsegmentStream = segment?.addNewSubsegment('yt-dlp-stream-to-s3')
    const uploadResult = await streamVideoToS3(fileUrl, bucket, fileName)
    if (subsegmentStream) {
      subsegmentStream.addAnnotation('s3Bucket', bucket)
      subsegmentStream.addAnnotation('s3Key', fileName)
      subsegmentStream.addMetadata('fileSize', uploadResult.fileSize)
      subsegmentStream.addMetadata('duration', uploadResult.duration)
      subsegmentStream.close()
    }
    logDebug('streamVideoToS3 =>', uploadResult)

    dynamoItem.size = uploadResult.fileSize
    dynamoItem.status = FileStatus.Downloaded

    logDebug('upsertFile <=', dynamoItem)
    await upsertFile(dynamoItem)
    logDebug('upsertFile =>')

    await putMetric('LambdaExecutionSuccess', 1)

    return response(context, 200, {
      fileId: videoInfo.id,
      status: 'success',
      fileSize: uploadResult.fileSize,
      duration: uploadResult.duration
    })
  } catch (error) {
    assertIsError(error)

    try {
      await upsertFile({
        fileId,
        status: FileStatus.Failed
      } as DynamoDBFile)
    } catch (updateError) {
      assertIsError(updateError)
      logDebug('upsertFile error =>', updateError.message)
    }

    await putMetric('LambdaExecutionFailure', 1, undefined, [{Name: 'ErrorType', Value: error.constructor.name}])

    if (error instanceof CookieExpirationError) {
      await putMetric('CookieAuthenticationFailure', 1, undefined, [{Name: 'VideoId', Value: fileId}])
      await createCookieExpirationIssue(fileId, fileUrl, error)
      return lambdaErrorResponse(context, new UnexpectedError(`Cookie expiration detected: ${error.message}`))
    }

    await createVideoDownloadFailureIssue(fileId, fileUrl, error, 'Video download failed during processing. Check CloudWatch logs for full details.')
    return lambdaErrorResponse(context, error)
  }
})
