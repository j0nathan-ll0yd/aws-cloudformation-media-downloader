import {Context} from 'aws-lambda'
import {chooseVideoFormat, fetchVideoInfo, FetchVideoInfoResult, streamVideoToS3} from '#lib/vendor/YouTube'
import {DynamoDBFile, StartFileUploadParams} from '#types/main'
import {FileStatus, ResponseStatus} from '#types/enums'
import {logDebug, logInfo, putMetric, putMetrics, response} from '#util/lambda-helpers'
import {assertIsError} from '#util/transformers'
import {UnexpectedError} from '#util/errors'
import {upsertFile} from '#util/shared'
import {createCookieExpirationIssue, createVideoDownloadFailureIssue} from '#util/github-helpers'
import {getSegment, withXRay} from '#lib/vendor/AWS/XRay'
import {getRequiredEnv} from '#util/env-validation'
import {classifyVideoError, isRetryExhausted, VideoErrorClassification} from '#util/video-error-classifier'
import {DownloadStatus, FileDownloads} from '#entities/FileDownloads'

/**
 * Update FileDownload entity with current download state.
 * This is the transient state that tracks retry attempts, errors, and scheduling.
 */
async function updateDownloadState(
  fileId: string,
  status: DownloadStatus,
  classification?: VideoErrorClassification,
  retryCount = 0
): Promise<void> {
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

  const segment = getSegment()

  // Step 1: Fetch video info (safe - never throws)
  logDebug('fetchVideoInfo <=', fileUrl)
  const subsegmentFetch = segment?.addNewSubsegment('yt-dlp-fetch-info')
  const videoInfoResult = await fetchVideoInfo(fileUrl)
  if (subsegmentFetch) {
    subsegmentFetch.addAnnotation('videoId', fileId)
    subsegmentFetch.addMetadata('videoUrl', fileUrl)
    subsegmentFetch.addMetadata('success', videoInfoResult.success)
    subsegmentFetch.close()
  }

  // Handle fetch failure
  if (!videoInfoResult.success || !videoInfoResult.info) {
    const error = videoInfoResult.error ?? new UnexpectedError('Failed to fetch video info')
    return handleDownloadFailure(fileId, fileUrl, error, videoInfoResult, existingRetryCount, existingMaxRetries, context)
  }

  const videoInfo = videoInfoResult.info
  logDebug('fetchVideoInfo =>', videoInfo)

  // Step 2: Choose format and prepare metadata
  let selectedFormat
  try {
    selectedFormat = chooseVideoFormat(videoInfo)
  } catch (error) {
    assertIsError(error)
    return handleDownloadFailure(fileId, fileUrl, error, videoInfoResult, existingRetryCount, existingMaxRetries, context)
  }
  logDebug('chooseVideoFormat =>', selectedFormat)

  const fileName = `${videoInfo.id}.${selectedFormat.ext}`
  const bucket = getRequiredEnv('Bucket')

  // Step 3: Stream video to S3
  logDebug('streamVideoToS3 <=', {url: fileUrl, bucket, key: fileName})
  const subsegmentStream = segment?.addNewSubsegment('yt-dlp-stream-to-s3')

  let uploadResult
  try {
    uploadResult = await streamVideoToS3(fileUrl, bucket, fileName)
  } catch (error) {
    if (subsegmentStream) {
      subsegmentStream.addError(error as Error)
      subsegmentStream.close()
    }
    assertIsError(error)
    return handleDownloadFailure(fileId, fileUrl, error, videoInfoResult, existingRetryCount, existingMaxRetries, context)
  }

  if (subsegmentStream) {
    subsegmentStream.addAnnotation('s3Bucket', bucket)
    subsegmentStream.addAnnotation('s3Key', fileName)
    subsegmentStream.addMetadata('fileSize', uploadResult.fileSize)
    subsegmentStream.addMetadata('duration', uploadResult.duration)
    subsegmentStream.close()
  }
  logDebug('streamVideoToS3 =>', uploadResult)

  // Step 4: Update permanent File entity with metadata (only on success)
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
    status: FileStatus.Available
  }

  logDebug('upsertFile <=', fileData)
  await upsertFile(fileData)
  logDebug('upsertFile =>')

  // Step 5: Mark download as completed
  await updateDownloadState(fileId, DownloadStatus.Completed, undefined, existingRetryCount)

  await putMetric('LambdaExecutionSuccess', 1)

  return response(context, 200, {fileId: videoInfo.id, status: ResponseStatus.Success, fileSize: uploadResult.fileSize, duration: uploadResult.duration})
})
