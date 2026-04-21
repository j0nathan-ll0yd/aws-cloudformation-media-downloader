/**
 * Webhook Processing Service
 *
 * Core webhook processing logic with idempotency support.
 * Handles file creation, association, and event emission for Feedly webhooks.
 */
import {emitEvent} from '@mantleframework/core'
import {addAnnotation, addMetadata, endSpan, logInfo, startSpan} from '@mantleframework/observability'
import {createIdempotencyStore, IdempotencyConfig, makeIdempotent} from '@mantleframework/resilience'
import {associateFileToUser} from '#domain/user/userFileService'
import {addFile, getFile, sendFileNotification} from '#services/file/fileInitService'
import {FileStatus, ResponseStatus} from '#types/enums'
import type {DownloadRequestedDetail} from '#types/events'
import type {WebhookProcessingInput, WebhookProcessingResult} from '#types/lambda'
import {logError} from '@mantleframework/observability'

/**
 * Core webhook processing logic - wrapped with idempotency.
 * Idempotency ensures duplicate webhook calls return the same response.
 */
async function processWebhookRequest(input: WebhookProcessingInput): Promise<WebhookProcessingResult> {
  const {fileId, userId, articleURL, correlationId} = input
  const span = startSpan('webhook-process')
  addAnnotation(span, 'fileId', fileId)
  addAnnotation(span, 'correlationId', correlationId)
  addMetadata(span, 'userId', userId)

  try {
    const [assocResult, fileResult] = await Promise.allSettled([associateFileToUser(fileId, userId), getFile(fileId)])
    const file = fileResult.status === 'fulfilled' ? fileResult.value : undefined
    if (assocResult.status === 'rejected') {
      logError('Failed to associate file to user', {fileId, userId, error: String(assocResult.reason)})
    }

    if (file && file.status === FileStatus.Downloaded) {
      await sendFileNotification(file, userId)
      addMetadata(span, 'action', 'dispatched')
      endSpan(span)
      return {statusCode: 200, status: ResponseStatus.Dispatched}
    } else {
      if (!file) {
        await addFile(fileId, articleURL, correlationId)
        addMetadata(span, 'newFile', true)
      }
      const eventDetail: DownloadRequestedDetail = {fileId, userId, sourceUrl: articleURL, correlationId, requestedAt: new Date().toISOString()}
      await emitEvent({detailType: 'DownloadRequested', detail: eventDetail})
      logInfo('Published DownloadRequested event', {fileId, correlationId})
      addMetadata(span, 'action', 'accepted')
      endSpan(span)
      return {statusCode: 202, status: ResponseStatus.Accepted}
    }
  } catch (error) {
    endSpan(span, error as Error)
    throw error
  }
}

// Idempotent wrapper - lazy initialization for env var availability
let idempotentProcessor: ((input: WebhookProcessingInput) => Promise<WebhookProcessingResult>) | null = null
let idempotencyConfig: IdempotencyConfig | null = null

/** Get the idempotent processor, lazily initialized */
export function getIdempotentProcessor(): {processor: (input: WebhookProcessingInput) => Promise<WebhookProcessingResult>; config: IdempotencyConfig} {
  if (!idempotentProcessor || !idempotencyConfig) {
    idempotencyConfig = new IdempotencyConfig({})
    idempotentProcessor = makeIdempotent(processWebhookRequest, {
      persistenceStore: createIdempotencyStore(),
      config: idempotencyConfig,
      dataIndexArgument: 0
    })
  }
  return {processor: idempotentProcessor, config: idempotencyConfig}
}
