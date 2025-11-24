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
import {classifyVideoError} from '../../../util/video-error-classifier'
import {Files} from '../../../entities/Files'
import {YtDlpVideoInfo} from '../../../types/youtube'

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

    let videoInfo: Partial<YtDlpVideoInfo> | undefined

    if (error instanceof CookieExpirationError) {
      await putMetric('CookieAuthenticationFailure', 1, undefined, [{Name: 'VideoId', Value: fileId}])
      await createCookieExpirationIssue(fileId, fileUrl, error)
      try {
        await upsertFile({
          fileId,
          status: FileStatus.Failed
        } as DynamoDBFile)
      } catch (updateError) {
        assertIsError(updateError)
        logDebug('upsertFile error =>', updateError.message)
      }
      return lambdaErrorResponse(context, new UnexpectedError(`Cookie expiration detected: ${error.message}`))
    }

    try {
      logDebug('Attempting to fetch video metadata for error classification')
      videoInfo = await fetchVideoInfo(fileUrl)
    } catch (metadataError) {
      logDebug('Could not fetch video metadata for classification', metadataError)
    }

    const classification = classifyVideoError(error, videoInfo)
    logInfo('Error classification', {
      category: classification.category,
      retryable: classification.retryable,
      retryAfter: classification.retryAfter,
      reason: classification.reason
    })

    if (classification.retryable && classification.retryAfter) {
      const existingFileResult = await Files.get({fileId}).go()
      const existingFile = existingFileResult?.data
      const retryCount = (existingFile?.retryCount || 0) + 1
      const maxRetries = existingFile?.maxRetries || 5

      if (retryCount > maxRetries) {
        logInfo(`Max retries (${maxRetries}) exceeded for fileId: ${fileId}`)
        try {
          await Files.update({fileId})
            .set({
              status: FileStatus.Failed,
              lastError: `Max retries exceeded: ${classification.reason}`,
              retryCount
            })
            .go()
        } catch (updateError) {
          assertIsError(updateError)
          logDebug('Files.update error =>', updateError.message)
        }
        await putMetric('MaxRetriesExceeded', 1, undefined, [{Name: 'VideoId', Value: fileId}])
        await createVideoDownloadFailureIssue(fileId, fileUrl, error, `Max retries exceeded: ${classification.reason}`)
      } else {
        logInfo(`Scheduling retry for fileId: ${fileId}`, {
          retryCount,
          retryAfter: new Date(classification.retryAfter * 1000).toISOString()
        })
        try {
          await Files.update({fileId})
            .set({
              status: FileStatus.Scheduled,
              retryAfter: classification.retryAfter,
              retryCount,
              lastError: classification.reason,
              scheduledPublishTime: videoInfo?.release_timestamp
            })
            .go()
        } catch (updateError) {
          assertIsError(updateError)
          logDebug('Files.update error =>', updateError.message)
        }
        await putMetric('VideoScheduledForRetry', 1, undefined, [{Name: 'Category', Value: classification.category}])
      }
    } else {
      try {
        await upsertFile({
          fileId,
          status: FileStatus.Failed,
          lastError: classification.reason
        } as DynamoDBFile)
      } catch (updateError) {
        assertIsError(updateError)
        logDebug('upsertFile error =>', updateError.message)
      }
      await createVideoDownloadFailureIssue(fileId, fileUrl, error, 'Video download failed during processing. Check CloudWatch logs for full details.')
    }

    await putMetric('LambdaExecutionFailure', 1, undefined, [{Name: 'ErrorType', Value: error.constructor.name}])
    return lambdaErrorResponse(context, error)
  }
})
