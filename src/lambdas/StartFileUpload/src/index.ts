/**
 * StartFileUpload Lambda
 *
 * Downloads YouTube videos to S3 using yt-dlp. Processes messages from
 * the download queue, handles retries, and publishes completion events.
 *
 * Trigger: SQS DownloadQueue (via EventBridge)
 * Input: SQSEvent with DownloadQueueMessage records
 * Output: SQSBatchResponse with item failures for retry
 */
import type {SQSBatchResponse, SQSEvent} from 'aws-lambda'
import {createFileDownload, getFileDownload, getUserFilesByFileId, updateFileDownload} from '#entities/queries'
import {sendMessage} from '#lib/vendor/AWS/SQS'
import {publishEvent} from '#lib/vendor/AWS/EventBridge'
import {addAnnotation, addMetadata, endSpan, startSpan} from '#lib/vendor/OpenTelemetry'
import {downloadVideoToS3, fetchVideoInfo} from '#lib/vendor/YouTube'
import type {File} from '#types/domain-models'
import type {DownloadCompletedDetail, DownloadFailedDetail, DownloadQueueMessage} from '#types/events'
import {DownloadStatus, FileStatus} from '#types/enums'
import type {FetchVideoInfoResult, VideoErrorClassification} from '#types/video'
import type {YtDlpVideoInfo} from '#types/youtube'
import {upsertFile} from './file-helpers'
import {getRequiredEnv} from '#lib/system/env'
import {UnexpectedError} from '#lib/system/errors'
import {createCookieExpirationIssue, createVideoDownloadFailureIssue} from '#lib/integrations/github/issue-service'
import {metrics, MetricUnit, withPowertools} from '#lib/lambda/middleware/powertools'
import {logDebug, logError, logInfo} from '#lib/system/logging'
import {createMetadataNotification} from '#lib/domain/notification/transformers'
import {classifyVideoError, isRetryExhausted} from '#lib/domain/video/error-classifier'

/**
 * Fetch video info with OpenTelemetry tracing.
 * Wraps fetchVideoInfo and handles span lifecycle.
 *
 * @param fileUrl - The video URL to fetch info for
 * @param fileId - The file ID for annotation
 * @returns The video info result
 */
async function fetchVideoInfoTraced(fileUrl: string, fileId: string): Promise<FetchVideoInfoResult> {
  const span = startSpan('yt-dlp-fetch-info')

  const result = await fetchVideoInfo(fileUrl)

  addAnnotation(span, 'videoId', fileId)
  addMetadata(span, 'videoUrl', fileUrl)
  addMetadata(span, 'success', result.success)
  endSpan(span)

  return result
}

/**
 * Download video to S3 with OpenTelemetry tracing.
 * Wraps downloadVideoToS3 and handles span lifecycle including error capture.
 *
 * @param fileUrl - The video URL to download
 * @param bucket - The S3 bucket to upload to
 * @param fileName - The S3 object key
 * @returns Object with fileSize, s3Url, and duration
 */
async function downloadVideoToS3Traced(fileUrl: string, bucket: string, fileName: string): Promise<{fileSize: number; s3Url: string; duration: number}> {
  const span = startSpan('yt-dlp-download-to-s3')
  try {
    const result = await downloadVideoToS3(fileUrl, bucket, fileName)
    addAnnotation(span, 's3Bucket', bucket)
    addAnnotation(span, 's3Key', fileName)
    addMetadata(span, 'fileSize', result.fileSize)
    addMetadata(span, 'duration', result.duration)
    endSpan(span)
    return result
  } catch (error) {
    endSpan(span, error as Error)
    throw error
  }
}

/**
 * Update FileDownload entity with current download state.
 * This is the transient state that tracks retry attempts, errors, and scheduling.
 * Cleanup handled by CleanupExpiredRecords scheduled Lambda.
 */
async function updateDownloadState(fileId: string, status: DownloadStatus, classification?: VideoErrorClassification, retryCount = 0): Promise<void> {
  const update: Record<string, unknown> = {status, retryCount}
  if (classification) {
    update.errorCategory = classification.category
    update.lastError = classification.reason
    update.maxRetries = classification.maxRetries ?? 5
    if (classification.retryAfter) {
      // Convert Unix epoch timestamp to Date
      update.retryAfter = new Date(classification.retryAfter * 1000)
    }
  }

  // Check if record exists
  const existing = await getFileDownload(fileId)

  if (existing) {
    logDebug('updateFileDownload <=', {fileId, update})
    const result = await updateFileDownload(fileId, update)
    logDebug('updateFileDownload =>', result)
  } else {
    // Create new record
    const createData = {
      fileId,
      status,
      retryCount,
      maxRetries: classification?.maxRetries ?? 5,
      errorCategory: classification?.category,
      lastError: classification?.reason,
      retryAfter: classification?.retryAfter ? new Date(classification.retryAfter * 1000) : null,
      sourceUrl: `https://www.youtube.com/watch?v=${fileId}`
    }
    logDebug('createFileDownload <=', createData)
    const result = await createFileDownload(createData)
    logDebug('createFileDownload =>', result)
  }
}

/**
 * Dispatch MetadataNotification to all users waiting for this file.
 * Sends notifications via SQS to the push notification queue.
 * @param fileId - The video ID
 * @param videoInfo - Video metadata from yt-dlp
 */
async function dispatchMetadataNotifications(fileId: string, videoInfo: YtDlpVideoInfo): Promise<void> {
  const queueUrl = getRequiredEnv('SNS_QUEUE_URL')

  // Get all users waiting for this file
  const userFiles = await getUserFilesByFileId(fileId)
  const userIds = userFiles.map((uf) => uf.userId)

  if (userIds.length === 0) {
    logDebug('No users waiting for file, skipping MetadataNotification')
    return
  }

  // Send MetadataNotification to each user
  // Use Promise.allSettled so one SQS error doesn't stop other user notifications
  const results = await Promise.allSettled(userIds.map((userId) => {
    const {messageBody, messageAttributes} = createMetadataNotification(fileId, videoInfo, userId)
    return sendMessage({QueueUrl: queueUrl, MessageBody: messageBody, MessageAttributes: messageAttributes})
  }))
  const failed = results.filter((r) => r.status === 'rejected').length

  logInfo('Dispatched MetadataNotifications', {fileId, succeeded: userIds.length - failed, failed})
}

/**
 * Result of handling a download failure.
 * Used to determine whether to throw (causing SQS retry) or return success.
 */
interface DownloadFailureResult {
  /** Whether the error is retryable via SQS visibility timeout */
  shouldRetry: boolean
  /** Error classification details */
  classification: VideoErrorClassification
}

/**
 * Handle download failure: classify error, update state, publish event, and determine next action.
 *
 * For SQS-triggered downloads:
 * - Transient errors: Update state, publish DownloadFailed event, throw to trigger SQS retry
 * - Permanent errors: Update state, publish DownloadFailed event, return success (removes from queue)
 *
 * @param fileId - The file ID that failed to download
 * @param fileUrl - The source video URL
 * @param error - The error that occurred
 * @param correlationId - Correlation ID for tracing
 * @param videoInfoResult - The video info fetch result
 * @param existingRetryCount - Current retry count for this download
 * @param existingMaxRetries - Maximum retries allowed
 * @returns Result indicating whether to retry
 */
async function handleDownloadFailure(
  fileId: string,
  fileUrl: string,
  error: Error,
  correlationId: string,
  videoInfoResult: FetchVideoInfoResult,
  existingRetryCount: number,
  existingMaxRetries: number
): Promise<DownloadFailureResult> {
  // Classify the error to determine retry strategy
  const classification = classifyVideoError(error, videoInfoResult.info, existingRetryCount)
  const newRetryCount = existingRetryCount + 1
  const maxRetries = classification.maxRetries ?? existingMaxRetries

  logInfo('Download failure classified', {
    fileId,
    correlationId,
    category: classification.category,
    retryable: classification.retryable,
    reason: classification.reason,
    retryCount: newRetryCount,
    maxRetries
  })

  // Publish DownloadFailed event for observability
  const failedDetail: DownloadFailedDetail = {
    fileId,
    correlationId,
    errorCategory: classification.category,
    errorMessage: classification.reason,
    retryable: classification.retryable && !isRetryExhausted(newRetryCount, maxRetries),
    retryCount: newRetryCount,
    failedAt: new Date().toISOString()
  }
  await publishEvent('DownloadFailed', failedDetail)

  // Handle retryable errors - let SQS handle retry via visibility timeout
  if (classification.retryable && !isRetryExhausted(newRetryCount, maxRetries)) {
    await updateDownloadState(fileId, DownloadStatus.Scheduled, classification, newRetryCount)

    metrics.addMetric('ScheduledVideoDetected', MetricUnit.Count, 1)
    const retryMetric = metrics.singleMetric()
    retryMetric.addDimension('Category', classification.category)
    retryMetric.addMetric('RetryScheduled', MetricUnit.Count, 1)

    logInfo(`Will retry via SQS for ${fileId}`, {reason: classification.reason, retryCount: newRetryCount})

    return {shouldRetry: true, classification}
  }

  // Handle permanent failures or retry exhaustion
  await updateDownloadState(fileId, DownloadStatus.Failed, classification, newRetryCount)

  // Also update File entity to reflect permanent failure
  try {
    await upsertFile({fileId, status: FileStatus.Failed} as File)
  } catch (updateError) {
    const message = updateError instanceof Error ? updateError.message : String(updateError)
    logDebug('Failed to update File entity status', message)
  }

  const failureMetric = metrics.singleMetric()
  failureMetric.addDimension('ErrorType', error.constructor.name)
  failureMetric.addMetric('LambdaExecutionFailure', MetricUnit.Count, 1)

  // Create GitHub issues for actionable failures
  if (classification.category === 'cookie_expired') {
    const cookieMetric = metrics.singleMetric()
    cookieMetric.addDimension('VideoId', fileId)
    cookieMetric.addMetric('CookieAuthenticationFailure', MetricUnit.Count, 1)
    await createCookieExpirationIssue(fileId, fileUrl, error)
  } else if (classification.category === 'permanent') {
    await createVideoDownloadFailureIssue(fileId, fileUrl, error, classification.reason)
  } else if (isRetryExhausted(newRetryCount, maxRetries)) {
    const exhaustedMetric = metrics.singleMetric()
    exhaustedMetric.addDimension('Category', classification.category)
    exhaustedMetric.addMetric('RetryExhausted', MetricUnit.Count, 1)
    logInfo(`Retry exhausted for ${fileId}`, {category: classification.category, retryCount: newRetryCount, maxRetries})
  }

  return {shouldRetry: false, classification}
}

/**
 * Process a single download request from SQS.
 *
 * Architecture:
 * - FileDownloads entity: Tracks transient download state (retries, scheduling, errors)
 * - Files entity: Stores permanent media metadata (only updated on success)
 *
 * Flow:
 * 1. Mark download as in_progress
 * 2. Fetch video info (safe - never throws)
 * 3. If fetch failed → classify → throw for SQS retry or return for removal
 * 4. If fetch succeeded → stream to S3
 * 5. If stream failed → classify → throw for SQS retry or return for removal
 * 6. If stream succeeded → update Files entity, publish DownloadCompleted event
 *
 * @param message - The download request from SQS
 * @throws Error if the download should be retried via SQS
 */
async function processDownloadRequest(message: DownloadQueueMessage): Promise<void> {
  const {fileId, correlationId, sourceUrl} = message
  const fileUrl = sourceUrl || `https://www.youtube.com/watch?v=${fileId}`

  logInfo('Processing download request', {fileId, correlationId, attempt: message.attempt})

  // Get existing download state for retry counting
  let existingRetryCount = 0
  let existingMaxRetries = 5
  logDebug('getFileDownload <=', {fileId})
  const existingDownload = await getFileDownload(fileId)
  logDebug('getFileDownload =>', existingDownload ?? 'null')
  if (existingDownload) {
    existingRetryCount = existingDownload.retryCount ?? 0
    existingMaxRetries = existingDownload.maxRetries ?? 5
  }

  // Mark download as in_progress
  await updateDownloadState(fileId, DownloadStatus.InProgress, undefined, existingRetryCount)

  // Step 1: Fetch video info (safe - never throws)
  logDebug('fetchVideoInfo <=', fileUrl)
  const videoInfoResult = await fetchVideoInfoTraced(fileUrl, fileId)

  if (!videoInfoResult.success || !videoInfoResult.info) {
    const error = videoInfoResult.error ?? new UnexpectedError('Failed to fetch video info')
    const result = await handleDownloadFailure(fileId, fileUrl, error, correlationId, videoInfoResult, existingRetryCount, existingMaxRetries)
    if (result.shouldRetry) {
      throw error // Throw to trigger SQS retry
    }
    return // Permanent failure - remove from queue
  }

  const videoInfo = videoInfoResult.info
  logDebug('fetchVideoInfo =>', videoInfo)

  // Dispatch MetadataNotification to all users waiting for this file
  await dispatchMetadataNotifications(fileId, videoInfo)

  // Step 2: Prepare for download
  const fileName = `${videoInfo.id}.mp4`
  const bucket = getRequiredEnv('BUCKET')

  // Step 3: Download video to S3
  logDebug('downloadVideoToS3 <=', {url: fileUrl, bucket, key: fileName})
  let uploadResult
  try {
    uploadResult = await downloadVideoToS3Traced(fileUrl, bucket, fileName)
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    const result = await handleDownloadFailure(fileId, fileUrl, err, correlationId, videoInfoResult, existingRetryCount, existingMaxRetries)
    if (result.shouldRetry) {
      throw err // Throw to trigger SQS retry
    }
    return // Permanent failure - remove from queue
  }
  logDebug('downloadVideoToS3 =>', uploadResult)

  // Step 4: Update permanent File entity with metadata (only on success)
  const cloudfrontDomain = getRequiredEnv('CLOUDFRONT_DOMAIN')
  const fileData: File = {
    fileId: videoInfo.id,
    key: fileName,
    size: uploadResult.fileSize,
    authorName: videoInfo.uploader || 'Unknown',
    authorUser: (videoInfo.uploader || 'unknown').toLowerCase().replace(/\s+/g, '_'),
    title: videoInfo.title,
    description: videoInfo.description || '',
    publishDate: videoInfo.upload_date || new Date().toISOString(),
    contentType: 'video/mp4',
    status: FileStatus.Downloaded,
    url: `https://${cloudfrontDomain}/${fileName}`
  }

  logDebug('upsertFile <=', fileData)
  await upsertFile(fileData)

  // Step 5: Mark download as completed
  await updateDownloadState(fileId, DownloadStatus.Completed, undefined, existingRetryCount)

  // Step 6: Publish DownloadCompleted event
  const completedDetail: DownloadCompletedDetail = {
    fileId,
    correlationId,
    s3Key: fileName,
    fileSize: uploadResult.fileSize,
    completedAt: new Date().toISOString()
  }
  await publishEvent('DownloadCompleted', completedDetail)

  metrics.addMetric('LambdaExecutionSuccess', MetricUnit.Count, 1)
  logInfo('Download completed successfully', {fileId, correlationId, fileSize: uploadResult.fileSize})
}

/**
 * SQS handler for video download requests.
 *
 * Consumes messages from DownloadQueue (routed via EventBridge from WebhookFeedly).
 * Uses ReportBatchItemFailures to enable partial batch success - failed messages
 * are returned to the queue for retry, successful ones are removed.
 *
 * @param event - SQS event containing download requests
 * @returns SQSBatchResponse with failed message IDs
 * @notExported
 */
export const handler = withPowertools(async (event: SQSEvent): Promise<SQSBatchResponse> => {
  logInfo('Processing download batch', {recordCount: event.Records.length})

  const batchItemFailures: {itemIdentifier: string}[] = []

  for (const record of event.Records) {
    try {
      const message: DownloadQueueMessage = JSON.parse(record.body)
      await processDownloadRequest(message)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logError('Download request failed', {messageId: record.messageId, error: errorMessage})
      batchItemFailures.push({itemIdentifier: record.messageId})
    }
  }

  if (batchItemFailures.length > 0) {
    logInfo('Batch completed with failures', {
      total: event.Records.length,
      failed: batchItemFailures.length,
      succeeded: event.Records.length - batchItemFailures.length
    })
  }

  return {batchItemFailures}
}, {enableCustomMetrics: true})
