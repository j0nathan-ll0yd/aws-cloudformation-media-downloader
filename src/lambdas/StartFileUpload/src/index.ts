import {Context} from 'aws-lambda'
import {downloadVideoToS3, fetchVideoInfo, FetchVideoInfoResult} from '#lib/vendor/YouTube'
import {DynamoDBFile, StartFileUploadParams} from '#types/main'
import {YtDlpVideoInfo} from '#types/youtube'
import {FileStatus, ResponseStatus} from '#types/enums'
import {logDebug, logInfo, putMetric, putMetrics, response} from '#util/lambda-helpers'
import {assertIsError, createMetadataNotification} from '#util/transformers'
import {UnexpectedError} from '#util/errors'
import {upsertFile} from '#util/shared'
import {createCookieExpirationIssue, createVideoDownloadFailureIssue} from '#util/github-helpers'
import {getSegment, withXRay} from '#lib/vendor/AWS/XRay'
import {getRequiredEnv} from '#util/env-validation'
import {classifyVideoError, isRetryExhausted, VideoErrorClassification} from '#util/video-error-classifier'
import {DownloadStatus, FileDownloads} from '#entities/FileDownloads'
import {UserFiles} from '#entities/UserFiles'
import {sendMessage} from '#lib/vendor/AWS/SQS'

/**
 * Fetch video info with X-Ray tracing.
 * Wraps fetchVideoInfo and handles subsegment lifecycle.
 */
async function fetchVideoInfoTraced(fileUrl: string, fileId: string): Promise<FetchVideoInfoResult> {
  const segment = getSegment()
  const subsegment = segment?.addNewSubsegment('yt-dlp-fetch-info')

  const result = await fetchVideoInfo(fileUrl)

  if (subsegment) {
    subsegment.addAnnotation('videoId', fileId)
    subsegment.addMetadata('videoUrl', fileUrl)
    subsegment.addMetadata('success', result.success)
    subsegment.close()
  }

  return result
}

/**
 * Download video to S3 with X-Ray tracing.
 * Wraps downloadVideoToS3 and handles subsegment lifecycle including error capture.
 */
async function downloadVideoToS3Traced(fileUrl: string, bucket: string, fileName: string): Promise<{fileSize: number; s3Url: string; duration: number}> {
  const segment = getSegment()
  const subsegment = segment?.addNewSubsegment('yt-dlp-download-to-s3')

  try {
    const result = await downloadVideoToS3(fileUrl, bucket, fileName)
    if (subsegment) {
      subsegment.addAnnotation('s3Bucket', bucket)
      subsegment.addAnnotation('s3Key', fileName)
      subsegment.addMetadata('fileSize', result.fileSize)
      subsegment.addMetadata('duration', result.duration)
      subsegment.close()
    }
    return result
  } catch (error) {
    if (subsegment) {
      subsegment.addError(error as Error)
      subsegment.close()
    }
    throw error
  }
}

/**
 * Update FileDownload entity with current download state.
 * This is the transient state that tracks retry attempts, errors, and scheduling.
 */
async function updateDownloadState(fileId: string, status: DownloadStatus, classification?: VideoErrorClassification, retryCount = 0): Promise<void> {
  const update: Record<string, unknown> = {status, retryCount}

  if (classification) {
    update.errorCategory = classification.category
    update.lastError = classification.reason
    update.maxRetries = classification.maxRetries ?? 5
    if (classification.retryAfter) {
      update.retryAfter = classification.retryAfter
    }
  }

  try {
    // Try to update existing record first
    await FileDownloads.update({fileId}).set(update).go()
  } catch {
    // If record doesn't exist, create it
    await FileDownloads.create({
      fileId,
      status,
      retryCount,
      maxRetries: classification?.maxRetries ?? 5,
      errorCategory: classification?.category,
      lastError: classification?.reason,
      retryAfter: classification?.retryAfter,
      sourceUrl: `https://www.youtube.com/watch?v=${fileId}`
    }).go()
  }
}

/**
 * Dispatch MetadataNotification to all users waiting for this file.
 * Sends notifications via SQS to the push notification queue.
 * @param fileId - The video ID
 * @param videoInfo - Video metadata from yt-dlp
 */
async function dispatchMetadataNotifications(fileId: string, videoInfo: YtDlpVideoInfo): Promise<void> {
  const queueUrl = getRequiredEnv('SNSQueueUrl')

  // Get all users waiting for this file
  const userFilesResponse = await UserFiles.query.byFile({fileId}).go()
  const userIds = userFilesResponse.data?.map((uf) => uf.userId) || []

  if (userIds.length === 0) {
    logDebug('No users waiting for file, skipping MetadataNotification')
    return
  }

  // Send MetadataNotification to each user
  await Promise.all(
    userIds.map((userId) => {
      const {messageBody, messageAttributes} = createMetadataNotification(fileId, videoInfo, userId)
      return sendMessage({
        QueueUrl: queueUrl,
        MessageBody: messageBody,
        MessageAttributes: messageAttributes
      })
    })
  )

  logInfo('Dispatched MetadataNotifications', {fileId, userCount: userIds.length})
}

/**
 * Handle download failure: classify error, update state, and determine next action.
 * Returns appropriate response based on whether download should be scheduled for retry.
 */
async function handleDownloadFailure(
  fileId: string,
  fileUrl: string,
  error: Error,
  videoInfoResult: FetchVideoInfoResult,
  existingRetryCount: number,
  existingMaxRetries: number,
  context: Context
): Promise<{statusCode: number; body: string}> {
  // Classify the error to determine retry strategy
  const classification = classifyVideoError(error, videoInfoResult.info, existingRetryCount)
  const newRetryCount = existingRetryCount + 1
  const maxRetries = classification.maxRetries ?? existingMaxRetries

  logInfo('Download failure classified', {
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
    await updateDownloadState(fileId, DownloadStatus.Scheduled, classification, newRetryCount)

    await putMetrics([
      {name: 'ScheduledVideoDetected', value: 1, unit: 'Count'},
      {name: 'RetryScheduled', value: 1, unit: 'Count', dimensions: [{Name: 'Category', Value: classification.category}]}
    ])

    logInfo(`Scheduled retry for ${fileId}`, {
      retryAfter: new Date(classification.retryAfter * 1000).toISOString(),
      reason: classification.reason,
      retryCount: newRetryCount
    })

    // Return success - scheduling a retry is expected behavior, not a failure
    return response(context, 200, {
      fileId,
      status: DownloadStatus.Scheduled,
      retryAfter: classification.retryAfter,
      retryCount: newRetryCount,
      reason: classification.reason
    })
  }

  // Handle permanent failures or retry exhaustion
  await updateDownloadState(fileId, DownloadStatus.Failed, classification, newRetryCount)

  // Also update File entity to reflect permanent failure
  try {
    await upsertFile({fileId, status: FileStatus.Unavailable} as DynamoDBFile)
  } catch (updateError) {
    assertIsError(updateError)
    logDebug('Failed to update File entity status', updateError.message)
  }

  await putMetric('LambdaExecutionFailure', 1, undefined, [{Name: 'ErrorType', Value: error.constructor.name}])

  // Create GitHub issues for actionable failures
  if (classification.category === 'cookie_expired') {
    await putMetric('CookieAuthenticationFailure', 1, undefined, [{Name: 'VideoId', Value: fileId}])
    await createCookieExpirationIssue(fileId, fileUrl, error)
  } else if (classification.category === 'permanent') {
    await createVideoDownloadFailureIssue(fileId, fileUrl, error, classification.reason)
  } else if (isRetryExhausted(newRetryCount, maxRetries)) {
    await putMetric('RetryExhausted', 1, undefined, [{Name: 'Category', Value: classification.category}])
    logInfo(`Retry exhausted for ${fileId}`, {category: classification.category, retryCount: newRetryCount, maxRetries})
  }

  return response(context, 500, {fileId, status: DownloadStatus.Failed, error: classification.reason, category: classification.category})
}

/**
 * Downloads a YouTube video and uploads it to S3.
 *
 * Architecture:
 * - FileDownloads entity: Tracks transient download state (retries, scheduling, errors)
 * - Files entity: Stores permanent media metadata (only updated on success)
 *
 * Flow:
 * 1. Mark download as in_progress
 * 2. Fetch video info (safe - never throws)
 * 3. If fetch failed → classify → schedule retry or mark failed
 * 4. If fetch succeeded → stream to S3
 * 5. If stream failed → classify → schedule retry or mark failed
 * 6. If stream succeeded → update Files entity with metadata
 *
 * @param event - Contains the fileId to download
 * @param context - AWS Lambda context
 * @notExported
 */
export const handler = withXRay(async (event: StartFileUploadParams, context: Context) => {
  logInfo('event <=', event)
  const fileId = event.fileId
  const fileUrl = `https://www.youtube.com/watch?v=${fileId}`

  // Get existing download state for retry counting
  let existingRetryCount = 0
  let existingMaxRetries = 5
  try {
    const {data: existingDownload} = await FileDownloads.get({fileId}).go()
    if (existingDownload) {
      existingRetryCount = existingDownload.retryCount ?? 0
      existingMaxRetries = existingDownload.maxRetries ?? 5
    }
  } catch {
    logDebug('No existing download record, using defaults')
  }

  // Mark download as in_progress
  await updateDownloadState(fileId, DownloadStatus.InProgress, undefined, existingRetryCount)

  // Step 1: Fetch video info (safe - never throws)
  logDebug('fetchVideoInfo <=', fileUrl)
  const videoInfoResult = await fetchVideoInfoTraced(fileUrl, fileId)

  if (!videoInfoResult.success || !videoInfoResult.info) {
    const error = videoInfoResult.error ?? new UnexpectedError('Failed to fetch video info')
    return handleDownloadFailure(fileId, fileUrl, error, videoInfoResult, existingRetryCount, existingMaxRetries, context)
  }

  const videoInfo = videoInfoResult.info
  logDebug('fetchVideoInfo =>', videoInfo)

  // Dispatch MetadataNotification to all users waiting for this file
  await dispatchMetadataNotifications(fileId, videoInfo)

  // Step 2: Prepare for download
  // Always use .mp4 extension - yt-dlp will merge to mp4 container
  const fileName = `${videoInfo.id}.mp4`
  const bucket = getRequiredEnv('Bucket')

  // Step 3: Download video to S3 (two-phase: temp file -> S3 stream)
  // yt-dlp handles format selection internally (best video + best audio, merged)
  logDebug('downloadVideoToS3 <=', {url: fileUrl, bucket, key: fileName})
  let uploadResult
  try {
    uploadResult = await downloadVideoToS3Traced(fileUrl, bucket, fileName)
  } catch (error) {
    assertIsError(error)
    return handleDownloadFailure(fileId, fileUrl, error, videoInfoResult, existingRetryCount, existingMaxRetries, context)
  }
  logDebug('downloadVideoToS3 =>', uploadResult)

  // Step 4: Update permanent File entity with metadata (only on success)
  const cloudfrontDomain = getRequiredEnv('CloudfrontDomain')
  const fileData: DynamoDBFile = {
    fileId: videoInfo.id,
    key: fileName,
    size: uploadResult.fileSize,
    authorName: videoInfo.uploader || 'Unknown',
    authorUser: (videoInfo.uploader || 'unknown').toLowerCase().replace(/\s+/g, '_'),
    title: videoInfo.title,
    description: videoInfo.description || '',
    publishDate: videoInfo.upload_date || new Date().toISOString(),
    contentType: 'video/mp4',
    status: FileStatus.Available,
    url: `https://${cloudfrontDomain}/${fileName}`
  }

  logDebug('upsertFile <=', fileData)
  await upsertFile(fileData)
  logDebug('upsertFile =>')

  // Step 5: Mark download as completed
  await updateDownloadState(fileId, DownloadStatus.Completed, undefined, existingRetryCount)

  await putMetric('LambdaExecutionSuccess', 1)

  return response(context, 200, {fileId: videoInfo.id, status: ResponseStatus.Success, fileSize: uploadResult.fileSize, duration: uploadResult.duration})
})
