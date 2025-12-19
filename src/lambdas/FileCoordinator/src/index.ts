import type {APIGatewayProxyResult, ScheduledEvent} from 'aws-lambda'
import {DownloadStatus, FileDownloads} from '#entities/FileDownloads'
import type {ApiHandlerParams} from '#types/lambda-wrappers'
import {logDebug, logInfo, putMetrics, response, withPowertools, wrapApiHandler} from '#util/lambda-helpers'
import {providerFailureErrorMessage, UnexpectedError} from '#util/errors'
import {initiateFileDownload} from '#util/shared'
import {getOptionalEnvNumber} from '#util/env-validation'

/** Minimal download info needed for processing */
interface DownloadInfo {
  fileId: string
  correlationId?: string
}

/** Maximum number of files to process concurrently per batch (configurable via FILE_COORDINATOR_BATCH_SIZE) */
const BATCH_SIZE = getOptionalEnvNumber('FILE_COORDINATOR_BATCH_SIZE', 5)

/** Delay between batches in milliseconds (configurable via FILE_COORDINATOR_BATCH_DELAY_MS) */
const BATCH_DELAY_MS = getOptionalEnvNumber('FILE_COORDINATOR_BATCH_DELAY_MS', 10000)

/**
 * Returns download info for FileDownloads with status='pending'.
 * These are new downloads (from WebhookFeedly) that haven't been attempted yet.
 * Uses FileDownloads.byStatusRetryAfter GSI to efficiently query.
 */
async function getPendingDownloads(): Promise<DownloadInfo[]> {
  logDebug('Querying for pending downloads ready to start')

  // Query FileDownloads with status='pending' - these are new downloads
  // Note: pending downloads don't have retryAfter set, so we just query by status
  const queryResponse = await FileDownloads.query.byStatusRetryAfter({status: DownloadStatus.Pending}).go()

  logDebug('getPendingDownloads =>', {count: queryResponse?.data?.length ?? 0})
  if (!queryResponse || !queryResponse.data) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return queryResponse.data.map((download) => ({fileId: download.fileId, correlationId: download.correlationId}))
}

/**
 * Returns download info for FileDownloads scheduled for retry.
 * These are downloads that failed but are retryable (scheduled videos, transient errors).
 * Uses FileDownloads.byStatusRetryAfter GSI to efficiently query.
 */
async function getScheduledDownloads(): Promise<DownloadInfo[]> {
  logDebug('Querying for scheduled downloads ready for retry')
  const nowSeconds = Math.floor(Date.now() / 1000)

  // Query FileDownloads with status='scheduled' and retryAfter <= now
  const queryResponse = await FileDownloads.query.byStatusRetryAfter({status: DownloadStatus.Scheduled}).where(({retryAfter}, {lte}) =>
    lte(retryAfter, nowSeconds)
  ).go()

  logDebug('getScheduledDownloads =>', {count: queryResponse?.data?.length ?? 0})
  if (!queryResponse || !queryResponse.data) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return queryResponse.data.map((download) => ({fileId: download.fileId, correlationId: download.correlationId}))
}

/**
 * Process downloads in batches with delays between batches
 * Prevents overwhelming YouTube/yt-dlp with concurrent requests
 */
async function processDownloadsInBatches(downloads: DownloadInfo[]): Promise<void> {
  for (let i = 0; i < downloads.length; i += BATCH_SIZE) {
    const batch = downloads.slice(i, i + BATCH_SIZE)
    logInfo(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}`, {batchSize: batch.length, remaining: downloads.length - i - batch.length})

    // Process batch concurrently, passing correlationId for tracing
    await Promise.all(batch.map(({fileId, correlationId}) => initiateFileDownload(fileId, correlationId)))

    // Add delay between batches (except for the last batch)
    if (i + BATCH_SIZE < downloads.length) {
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
export const handler = withPowertools(wrapApiHandler(async ({context}: ApiHandlerParams<ScheduledEvent>): Promise<APIGatewayProxyResult> => {
  // Query both pending and scheduled downloads in parallel
  const [pendingDownloads, scheduledDownloads] = await Promise.all([getPendingDownloads(), getScheduledDownloads()])

  // Combine downloads, deduplicate by fileId
  const seenFileIds = new Set<string>()
  const allDownloads: DownloadInfo[] = []
  for (const download of [...pendingDownloads, ...scheduledDownloads]) {
    if (!seenFileIds.has(download.fileId)) {
      seenFileIds.add(download.fileId)
      allDownloads.push(download)
    }
  }

  logInfo('Files to process', {pending: pendingDownloads.length, scheduled: scheduledDownloads.length, total: allDownloads.length})

  // Publish metrics for monitoring
  await putMetrics([
    {name: 'PendingFilesFound', value: pendingDownloads.length, unit: 'Count'},
    {name: 'ScheduledFilesFound', value: scheduledDownloads.length, unit: 'Count'},
    {name: 'TotalFilesToProcess', value: allDownloads.length, unit: 'Count'}
  ])

  if (allDownloads.length === 0) {
    logInfo('No files to process')
    return response(context, 200, {processed: 0})
  }

  // Process downloads in batches to avoid overwhelming yt-dlp
  await processDownloadsInBatches(allDownloads)

  logInfo('All files processed', {total: allDownloads.length})
  return response(context, 200, {processed: allDownloads.length, pending: pendingDownloads.length, scheduled: scheduledDownloads.length})
}))
