import {Context} from 'aws-lambda'
import {chooseVideoFormat, fetchVideoInfo, fetchVideoInfoSafe, streamVideoToS3} from '#lib/vendor/YouTube'
import {DynamoDBFile, StartFileUploadParams} from '#types/main'
import {FileStatus, ResponseStatus} from '#types/enums'
import {lambdaErrorResponse, logDebug, logInfo, putMetric, putMetrics, response} from '#util/lambda-helpers'
import {assertIsError} from '#util/transformers'
import {UnexpectedError} from '#util/errors'
import {upsertFile} from '#util/shared'
import {createCookieExpirationIssue, createVideoDownloadFailureIssue} from '#util/github-helpers'
import {getSegment, withXRay} from '#lib/vendor/AWS/XRay'
import {getRequiredEnv} from '#util/env-validation'
import {classifyVideoError, isRetryExhausted} from '#util/video-error-classifier'
import {Files} from '#entities/Files'

/**
 * Downloads a YouTube video and uploads it to S3
 * @param event - Contains the fileId to download
 * @param context - AWS Lambda context
 * @notExported
 */
export const handler = withXRay(async (event: StartFileUploadParams, context: Context) => {
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
    const bucket = getRequiredEnv('Bucket')

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

    return response(context, 200, {fileId: videoInfo.id, status: ResponseStatus.Success, fileSize: uploadResult.fileSize, duration: uploadResult.duration})
  } catch (error) {
    assertIsError(error)

    // Attempt to fetch video metadata even after failure (may have release_timestamp for scheduled videos)
    const videoInfoSafe = await fetchVideoInfoSafe(fileUrl)

    // Get existing file for retry count
    let existingRetryCount = 0
    let existingMaxRetries = 5
    try {
      const {data: existingFile} = await Files.get({fileId}).go()
      if (existingFile) {
        existingRetryCount = existingFile.retryCount ?? 0
        existingMaxRetries = existingFile.maxRetries ?? 5
      }
    } catch {
      logDebug('Failed to get existing file for retry count, using defaults')
    }

    // Classify the error to determine retry strategy
    const classification = classifyVideoError(error, videoInfoSafe, existingRetryCount)
    const newRetryCount = existingRetryCount + 1
    const maxRetries = classification.maxRetries ?? existingMaxRetries

    logInfo('Error classification', {
      fileId,
      category: classification.category,
      retryable: classification.retryable,
      retryAfter: classification.retryAfter ? new Date(classification.retryAfter * 1000).toISOString() : undefined,
      reason: classification.reason,
      retryCount: newRetryCount,
      maxRetries
    })

    // Handle retryable errors with scheduled retry
    if (classification.retryable && classification.retryAfter && !isRetryExhausted(newRetryCount, maxRetries)) {
      try {
        await upsertFile(
          {
            fileId,
            status: FileStatus.Scheduled,
            availableAt: classification.retryAfter,
            retryAfter: classification.retryAfter,
            retryCount: newRetryCount,
            maxRetries,
            lastError: classification.reason,
            scheduledPublishTime: videoInfoSafe?.release_timestamp,
            errorCategory: classification.category
          } as DynamoDBFile
        )

        await putMetrics([
          {name: 'ScheduledVideoDetected', value: 1, unit: 'Count'},
          {name: 'RetryScheduled', value: 1, unit: 'Count', dimensions: [{Name: 'Category', Value: classification.category}]}
        ])

        logInfo(`Scheduled retry for ${fileId}`, {
          retryAfter: new Date(classification.retryAfter * 1000).toISOString(),
          reason: classification.reason,
          retryCount: newRetryCount
        })

        // Return success - this is expected behavior for scheduled videos, NOT a failure
        return response(context, 200, {
          fileId,
          status: 'scheduled',
          retryAfter: classification.retryAfter,
          retryCount: newRetryCount,
          reason: classification.reason
        })
      } catch (updateError) {
        assertIsError(updateError)
        logDebug('Failed to schedule retry, falling through to failure handling', updateError.message)
      }
    }

    // Handle permanent failures or retry exhaustion
    try {
      await upsertFile(
        {
          fileId,
          status: FileStatus.Failed,
          lastError: classification.reason,
          retryCount: newRetryCount,
          errorCategory: classification.category
        } as DynamoDBFile
      )
    } catch (updateError) {
      assertIsError(updateError)
      logDebug('upsertFile error =>', updateError.message)
    }

    await putMetric('LambdaExecutionFailure', 1, undefined, [{Name: 'ErrorType', Value: error.constructor.name}])

    // Only create GitHub issues for permanent failures and cookie expiration
    // Skip GitHub issues for retry exhaustion of transient/scheduled errors (they had their chance)
    if (classification.category === 'cookie_expired') {
      await putMetric('CookieAuthenticationFailure', 1, undefined, [{Name: 'VideoId', Value: fileId}])
      await createCookieExpirationIssue(fileId, fileUrl, error)
      return lambdaErrorResponse(context, new UnexpectedError(`Cookie expiration detected: ${error.message}`))
    }

    if (classification.category === 'permanent') {
      await createVideoDownloadFailureIssue(fileId, fileUrl, error, classification.reason)
    } else if (isRetryExhausted(newRetryCount, maxRetries)) {
      // Retry exhaustion - log but don't create issue (it's noise, not actionable)
      await putMetric('RetryExhausted', 1, undefined, [{Name: 'Category', Value: classification.category}])
      logInfo(`Retry exhausted for ${fileId}`, {category: classification.category, retryCount: newRetryCount, maxRetries})
    }

    return lambdaErrorResponse(context, error)
  }
})
