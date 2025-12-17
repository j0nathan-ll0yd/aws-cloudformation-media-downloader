import {APIGatewayProxyResult, ScheduledEvent} from 'aws-lambda'
import {DownloadStatus, FileDownloads} from '#entities/FileDownloads'
import {ApiHandlerParams, logDebug, logInfo, putMetrics, response, wrapApiHandler} from '#util/lambda-helpers'
import {providerFailureErrorMessage, UnexpectedError} from '#util/errors'
import {initiateFileDownload} from '#util/shared'
import {withXRay} from '#lib/vendor/AWS/XRay'

/** Maximum number of files to process concurrently per batch */
const BATCH_SIZE = 5

/** Delay between batches in milliseconds (to avoid overwhelming yt-dlp/YouTube) */
const BATCH_DELAY_MS = 10000

/**
 * Returns an array of fileIds from FileDownloads with status='pending'.
 * These are new downloads (from WebhookFeedly) that haven't been attempted yet.
 * Uses FileDownloads.byStatusRetryAfter GSI to efficiently query.
 */
async function getPendingFileIds(): Promise<string[]> {
  logDebug('Querying for pending downloads ready to start')

  // Query FileDownloads with status='pending' - these are new downloads
  // Note: pending downloads don't have retryAfter set, so we just query by status
  const queryResponse = await FileDownloads.query.byStatusRetryAfter({status: DownloadStatus.Pending}).go()

  logDebug('getPendingFileIds =>', {count: queryResponse?.data?.length ?? 0})
  if (!queryResponse || !queryResponse.data) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return queryResponse.data.map((download) => download.fileId)
}

/**
 * Returns an array of fileIds from FileDownloads scheduled for retry.
 * These are downloads that failed but are retryable (scheduled videos, transient errors).
 * Uses FileDownloads.byStatusRetryAfter GSI to efficiently query.
 */
async function getScheduledFileIds(): Promise<string[]> {
  logDebug('Querying for scheduled downloads ready for retry')
  const nowSeconds = Math.floor(Date.now() / 1000)

  // Query FileDownloads with status='scheduled' and retryAfter <= now
  const queryResponse = await FileDownloads.query.byStatusRetryAfter({status: DownloadStatus.Scheduled}).where(({retryAfter}, {lte}) => lte(retryAfter, nowSeconds)).go()

  logDebug('getScheduledFileIds =>', {count: queryResponse?.data?.length ?? 0})
  if (!queryResponse || !queryResponse.data) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return queryResponse.data.map((download) => download.fileId)
}

/**
 * Process files in batches with delays between batches
 * Prevents overwhelming YouTube/yt-dlp with concurrent requests
 */
async function processFilesInBatches(fileIds: string[]): Promise<void> {
  for (let i = 0; i < fileIds.length; i += BATCH_SIZE) {
    const batch = fileIds.slice(i, i + BATCH_SIZE)
    logInfo(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}`, {batchSize: batch.length, remaining: fileIds.length - i - batch.length})

    // Process batch concurrently
    await Promise.all(batch.map((fileId) => initiateFileDownload(fileId)))

    // Add delay between batches (except for the last batch)
    if (i + BATCH_SIZE < fileIds.length) {
      logDebug(`Waiting ${BATCH_DELAY_MS}ms before next batch`)
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
    }
  }
}

/**
 * A scheduled event lambda that checks for files to be downloaded
 * Processes both new pending files and scheduled files ready for retry
 * @param event - An AWS ScheduledEvent; happening every X minutes
 * @param context - An AWS Context object
 */
export const handler = withXRay(wrapApiHandler(async ({context}: ApiHandlerParams<ScheduledEvent>): Promise<APIGatewayProxyResult> => {
  // Query both pending and scheduled files in parallel
  const [pendingFileIds, scheduledFileIds] = await Promise.all([getPendingFileIds(), getScheduledFileIds()])

  // Combine and deduplicate (shouldn't have duplicates, but safety first)
  const allFileIds = [...new Set([...pendingFileIds, ...scheduledFileIds])]

  logInfo('Files to process', {pending: pendingFileIds.length, scheduled: scheduledFileIds.length, total: allFileIds.length})

  // Publish metrics for monitoring
  await putMetrics([
    {name: 'PendingFilesFound', value: pendingFileIds.length, unit: 'Count'},
    {name: 'ScheduledFilesFound', value: scheduledFileIds.length, unit: 'Count'},
    {name: 'TotalFilesToProcess', value: allFileIds.length, unit: 'Count'}
  ])

  if (allFileIds.length === 0) {
    logInfo('No files to process')
    return response(context, 200, {processed: 0})
  }

  // Process files in batches to avoid overwhelming yt-dlp
  await processFilesInBatches(allFileIds)

  logInfo('All files processed', {total: allFileIds.length})
  return response(context, 200, {processed: allFileIds.length, pending: pendingFileIds.length, scheduled: scheduledFileIds.length})
}))
