import type {APIGatewayProxyResult, Context} from 'aws-lambda'
import {DownloadStatus, FileDownloads} from '#entities/FileDownloads'
import {UserFiles} from '#entities/UserFiles'
import {sendMessage} from '#lib/vendor/AWS/SQS'
import {addAnnotation, addMetadata, endSpan, startSpan} from '#lib/vendor/OpenTelemetry'
import {downloadVideoToS3, fetchVideoInfo} from '#lib/vendor/YouTube'
import type {File} from '#types/domain-models'
import {FileStatus, ResponseStatus} from '#types/enums'
import type {FetchVideoInfoResult, VideoErrorClassification} from '#types/video'
import type {YtDlpVideoInfo} from '#types/youtube'
import {getRequiredEnv} from '#lib/system/env'
import {UnexpectedError} from '#lib/system/errors'
import {createCookieExpirationIssue, createVideoDownloadFailureIssue} from '#lib/integrations/github/issue-service'
import {buildApiResponse} from '#lib/lambda/responses'
import {metrics, MetricUnit, withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapLambdaInvokeHandler} from '#lib/lambda/middleware/internal'
import {logDebug, logInfo} from '#lib/system/logging'
import {createMetadataNotification} from '#lib/domain/notification/transformers'
import {classifyVideoError, isRetryExhausted} from '#lib/domain/video/error-classifier'
import {upsertFile} from './file-helpers'

interface StartFileUploadParams {
  fileId: string
  /** Correlation ID for end-to-end request tracing */
  correlationId?: string
}

/**
 * Fetch video info with OpenTelemetry tracing.
 * Wraps fetchVideoInfo and handles span lifecycle.
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
 * TTL is automatically set for completed/failed statuses.
 */
async function updateDownloadState(fileId: string, status: DownloadStatus, classification?: VideoErrorClassification, retryCount = 0): Promise<void> {
  const update: Record<string, unknown> = {status, retryCount}

  // Set TTL for completed/failed downloads (auto-cleanup after 7 days)
  if (status === DownloadStatus.Completed || status === DownloadStatus.Failed) {
    update.ttl = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
  }

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
    logDebug('FileDownloads.update <=', {fileId, update})
    const updateResponse = await FileDownloads.update({fileId}).set(update).go()
    logDebug('FileDownloads.update =>', updateResponse)
  } catch {
    // If record doesn't exist, create it
    const createData = {
      fileId,
      status,
      retryCount,
      maxRetries: classification?.maxRetries ?? 5,
      errorCategory: classification?.category,
      lastError: classification?.reason,
      retryAfter: classification?.retryAfter,
      sourceUrl: `https://www.youtube.com/watch?v=${fileId}`,
      ttl: update.ttl as number | undefined
    }
    logDebug('FileDownloads.create <=', createData)
    const createResponse = await FileDownloads.create(createData).go()
    logDebug('FileDownloads.create =>', createResponse)
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
  const userFilesResponse = await UserFiles.query.byFile({fileId}).go()
  const userIds = userFilesResponse.data?.map((uf) => uf.userId) || []

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

    // Metrics flushed automatically by Powertools middleware
    metrics.addMetric('ScheduledVideoDetected', MetricUnit.Count, 1)
    // Use singleMetric for metric with unique dimension
    const retryMetric = metrics.singleMetric()
    retryMetric.addDimension('Category', classification.category)
    retryMetric.addMetric('RetryScheduled', MetricUnit.Count, 1)

    logInfo(`Scheduled retry for ${fileId}`, {
      retryAfter: new Date(classification.retryAfter * 1000).toISOString(),
      reason: classification.reason,
      retryCount: newRetryCount
    })

    // Return success - scheduling a retry is expected behavior, not a failure
    return buildApiResponse(context, 200, {
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
    await upsertFile({fileId, status: FileStatus.Failed} as File)
  } catch (updateError) {
    const message = updateError instanceof Error ? updateError.message : String(updateError)
    logDebug('Failed to update File entity status', message)
  }

  // Use singleMetric for metrics with unique dimensions
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

  return buildApiResponse(context, 500, {fileId, status: DownloadStatus.Failed, error: classification.reason, category: classification.category})
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
export const handler = withPowertools(wrapLambdaInvokeHandler<StartFileUploadParams, APIGatewayProxyResult>(async ({event, context}) => {
  const correlationId = event.correlationId || context.awsRequestId
  logInfo('Processing request', {correlationId, fileId: event.fileId})

  const fileId = event.fileId
  const fileUrl = `https://www.youtube.com/watch?v=${fileId}`

  // Get existing download state for retry counting
  let existingRetryCount = 0
  let existingMaxRetries = 5
  try {
    logDebug('FileDownloads.get <=', {fileId})
    const {data: existingDownload} = await FileDownloads.get({fileId}).go()
    logDebug('FileDownloads.get =>', existingDownload ?? 'null')
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
  const bucket = getRequiredEnv('BUCKET')

  // Step 3: Download video to S3 (two-phase: temp file -> S3 stream)
  // yt-dlp handles format selection internally (best video + best audio, merged)
  logDebug('downloadVideoToS3 <=', {url: fileUrl, bucket, key: fileName})
  let uploadResult
  try {
    uploadResult = await downloadVideoToS3Traced(fileUrl, bucket, fileName)
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    return handleDownloadFailure(fileId, fileUrl, err, videoInfoResult, existingRetryCount, existingMaxRetries, context)
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

  metrics.addMetric('LambdaExecutionSuccess', MetricUnit.Count, 1)

  return buildApiResponse(context, 200, {
    fileId: videoInfo.id,
    status: ResponseStatus.Success,
    fileSize: uploadResult.fileSize,
    duration: uploadResult.duration
  })
}), {enableCustomMetrics: true})
