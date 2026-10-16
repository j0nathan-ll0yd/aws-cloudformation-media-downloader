/**
 * Download State
 *
 * Reads the prior FileDownload record for retry counting in StartFileUpload.
 */
import {getFileDownload} from '#entities/queries'
import {logDebug, logInfo} from '@j0nathan-ll0yd/observability'

/**
 * Retrieve existing download state for retry counting.
 * Returns default values if no prior download record exists.
 */
export async function getExistingDownloadState(fileId: string): Promise<{retryCount: number; maxRetries: number}> {
  logDebug('getFileDownload <=', {fileId})
  const existingDownload = await getFileDownload(fileId)
  logDebug('getFileDownload =>', (existingDownload as unknown as Record<string, unknown>) ?? {found: false})

  if (!existingDownload) {
    return {retryCount: 0, maxRetries: 5}
  }

  if (existingDownload.lastError) {
    logInfo('Previous failure state', {
      fileId,
      previousStatus: existingDownload.status,
      previousError: existingDownload.lastError,
      errorCategory: existingDownload.errorCategory,
      retryCount: existingDownload.retryCount ?? 0,
      maxRetries: existingDownload.maxRetries ?? 5
    })
  }

  return {retryCount: existingDownload.retryCount ?? 0, maxRetries: existingDownload.maxRetries ?? 5}
}
