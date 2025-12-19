/**
 * Lambda Invocation Helpers
 *
 * Shared utilities for Lambda-to-Lambda invocations.
 */
import {logDebug} from './logging'
import {invokeAsync} from '#lib/vendor/AWS/Lambda'

/**
 * Initiates a file download by invoking the StartFileUpload Lambda
 * Uses asynchronous invocation (Event type) to avoid blocking
 * @param fileId - The YouTube video ID to download
 * @param correlationId - Optional correlation ID for end-to-end request tracing
 * @see {@link lambdas/FileCoordinator/src!#handler | FileCoordinator }
 * @see {@link lambdas/WebhookFeedly/src!#handler | WebhookFeedly }
 */
export async function initiateFileDownload(fileId: string, correlationId?: string) {
  logDebug('initiateFileDownload <=', {fileId, correlationId})

  const result = await invokeAsync('StartFileUpload', {fileId, correlationId})

  logDebug('initiateFileDownload =>', {StatusCode: result.StatusCode, fileId, correlationId})
}
