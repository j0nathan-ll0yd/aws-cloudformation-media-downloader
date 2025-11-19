import {Context} from 'aws-lambda'
import {fetchVideoInfo, chooseVideoFormat, streamVideoToS3} from '../../../lib/vendor/YouTube'
import {query} from '../../../lib/vendor/AWS/DynamoDB'
import {StartFileUploadParams, DynamoDBFile} from '../../../types/main'
import {FileStatus} from '../../../types/enums'
import {logDebug, logInfo, putMetric, lambdaErrorResponse, response} from '../../../util/lambda-helpers'
import {assertIsError} from '../../../util/transformers'
import {UnexpectedError, CookieExpirationError, providerFailureErrorMessage} from '../../../util/errors'
import {upsertFile} from '../../../util/shared'
import {createVideoDownloadFailureIssue, createCookieExpirationIssue} from '../../../util/github-helpers'
import {classifyVideoError} from '../../../util/video-error-classifier'
import {queryFileParams} from '../../../util/dynamodb-helpers'
import {YtDlpVideoInfo} from '../../../types/youtube'

/**
 * Retrieves a file record from DynamoDB
 * @param fileId - The file ID to retrieve
 * @returns The file record if found, undefined otherwise
 * @notExported
 */
async function getFile(fileId: string): Promise<DynamoDBFile | undefined> {
  const params = queryFileParams(process.env.DynamoDBTableFiles as string, fileId)
  logDebug('getFile <=', params)
  const response = await query(params)
  logDebug('getFile =>', response)
  if (response.Items && response.Items.length > 0) {
    return response.Items[0] as DynamoDBFile
  }
  return undefined
}

/**
 * Downloads a YouTube video and uploads it to S3
 * @param event - Contains the fileId to download
 * @param context - AWS Lambda context
 * @notExported
 */
export async function handler(event: StartFileUploadParams, context: Context) {
  logInfo('event <=', event)
  const fileId = event.fileId
  const fileUrl = `https://www.youtube.com/watch?v=${fileId}`

  try {
    logDebug('fetchVideoInfo <=', fileUrl)
    const videoInfo = await fetchVideoInfo(fileUrl)
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
    const uploadResult = await streamVideoToS3(fileUrl, bucket, fileName)
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

    try {
      logDebug('fetchVideoInfo (metadata only) <=', fileUrl)
      videoInfo = await fetchVideoInfo(fileUrl)
    } catch {
      logDebug('fetchVideoInfo (metadata only) => failed')
    }

    const classification = classifyVideoError(error, videoInfo)
    logDebug('classifyVideoError =>', classification)

    if (classification.retryable && classification.retryAfter) {
      const existingFile = await getFile(fileId)
      const retryCount = (existingFile?.retryCount || 0) + 1
      const maxRetries = existingFile?.maxRetries || 5

      if (retryCount > maxRetries) {
        await upsertFile({
          fileId,
          status: FileStatus.Failed,
          lastError: classification.reason,
          retryCount
        } as DynamoDBFile)

        await putMetric('ScheduledVideoMaxRetriesExceeded', 1, undefined, [{Name: 'VideoId', Value: fileId}])

        await createVideoDownloadFailureIssue(fileId, fileUrl, error, `Failed after ${retryCount} retry attempts. Last error: ${classification.reason}`)

        return lambdaErrorResponse(context, new UnexpectedError(`Max retries (${maxRetries}) exceeded for scheduled video`))
      }

      await upsertFile({
        fileId,
        status: FileStatus.Scheduled,
        retryAfter: classification.retryAfter,
        retryCount,
        lastError: classification.reason,
        scheduledPublishTime: videoInfo?.release_timestamp
      } as DynamoDBFile)

      await putMetric('ScheduledVideoRetryQueued', 1, undefined, [
        {Name: 'VideoId', Value: fileId},
        {Name: 'RetryCount', Value: retryCount.toString()}
      ])

      logInfo('Scheduled video retry', {
        fileId,
        retryCount,
        retryAfter: new Date(classification.retryAfter * 1000).toISOString(),
        reason: classification.reason
      })

      return response(context, 202, {
        fileId,
        status: 'scheduled',
        retryCount,
        retryAfter: classification.retryAfter,
        message: classification.reason
      })
    }

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

    await putMetric('LambdaExecutionFailure', 1, undefined, [
      {Name: 'ErrorType', Value: error.constructor.name},
      {Name: 'ErrorCategory', Value: classification.category}
    ])

    if (error instanceof CookieExpirationError) {
      await putMetric('CookieAuthenticationFailure', 1, undefined, [{Name: 'VideoId', Value: fileId}])
      await createCookieExpirationIssue(fileId, fileUrl, error)
      return lambdaErrorResponse(context, new UnexpectedError(`Cookie expiration detected: ${error.message}`))
    }

    await createVideoDownloadFailureIssue(fileId, fileUrl, error, `Permanent failure (${classification.category}): ${classification.reason}`)
    return lambdaErrorResponse(context, error)
  }
}
