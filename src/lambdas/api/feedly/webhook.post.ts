/**
 * WebhookFeedly Lambda
 *
 * Receives Feedly webhook notifications for new YouTube videos.
 * Validates the article URL, creates a file record, and queues for download.
 *
 * Trigger: API Gateway POST /feedly/webhook
 * Input: FeedlyWebhookRequest with articleURL
 * Output: APIGatewayProxyResult with file metadata
 */
import {sendMessage} from '@mantleframework/aws'
import {buildValidatedResponse, emitEvent} from '@mantleframework/core'
import {getRequiredEnv} from '@mantleframework/env'
import {UnauthorizedError} from '@mantleframework/errors'
import {addAnnotation, addMetadata, endSpan, logDebug, logError, logInfo, metrics, MetricUnit, startSpan} from '@mantleframework/observability'
import {createIdempotencyStore, IdempotencyConfig, makeIdempotent} from '@mantleframework/resilience'
import {defineApiHandler, z} from '@mantleframework/validation'
import {associateFileToUser} from '#domain/user/userFileService'
import {createFile, createFileDownload, getFile as getFileRecord} from '#entities/queries'
import {createDownloadReadyNotification} from '#services/notification/transformers'
import {getVideoID} from '#services/youtube/youtube'
import {webhookResponseSchema} from '#types/api-schema'
import type {File} from '#types/domainModels'
import {DownloadStatus, FileStatus, ResponseStatus} from '#types/enums'
import type {DownloadRequestedDetail} from '#types/events'
import type {WebhookProcessingInput, WebhookProcessingResult} from '#types/lambda'

// Add file and download tracking records
async function addFile(fileId: string, sourceUrl?: string, correlationId?: string) {
  logDebug('addFile', {fileId, sourceUrl, correlationId})

  // Create placeholder Files record (will be updated with real metadata on successful download)
  await createFile({
    fileId,
    size: 0,
    status: FileStatus.Queued,
    authorName: '',
    authorUser: '',
    publishDate: new Date().toISOString(),
    description: '',
    key: fileId,
    contentType: '',
    title: ''
  })
  logDebug('addFile createFile completed', {fileId})

  // Create FileDownloads record to track download orchestration
  await createFileDownload({fileId, status: DownloadStatus.Pending, sourceUrl, correlationId})
  logDebug('addFile createFileDownload completed', {fileId})
}

// Get file by ID
async function getFile(fileId: string): Promise<File | undefined> {
  logDebug('getFile', {fileId})
  const file = await getFileRecord(fileId)
  logDebug('getFile result', {fileId, found: !!file})
  return file as File | undefined
}

/**
 * Sends a DownloadReadyNotification to the user
 */
async function sendFileNotification(file: File, userId: string) {
  const {messageBody, messageAttributes} = createDownloadReadyNotification(file, userId)
  const sendMessageParams = {MessageBody: messageBody, MessageAttributes: messageAttributes, QueueUrl: getRequiredEnv('SNS_QUEUE_URL')}
  logDebug('sendMessage', {queueUrl: sendMessageParams.QueueUrl})
  const sendMessageResponse = await sendMessage(sendMessageParams)
  logDebug('sendMessage completed', {messageId: sendMessageResponse?.MessageId})
  return sendMessageResponse
}

/**
 * Core webhook processing logic - wrapped with idempotency.
 * This function handles the actual file processing and returns the result.
 * Idempotency ensures duplicate webhook calls return the same response.
 */
async function processWebhookRequest(input: WebhookProcessingInput): Promise<WebhookProcessingResult> {
  const {fileId, userId, articleURL, correlationId} = input
  const span = startSpan('webhook-process')
  addAnnotation(span, 'fileId', fileId)
  addAnnotation(span, 'correlationId', correlationId)
  addMetadata(span, 'userId', userId)

  try {
    // Parallelize independent operations for ~60% latency reduction
    // Use Promise.allSettled to handle partial failures gracefully
    const [assocResult, fileResult] = await Promise.allSettled([associateFileToUser(fileId, userId), getFile(fileId)])
    const file = fileResult.status === 'fulfilled' ? fileResult.value : undefined
    if (assocResult.status === 'rejected') {
      logError('Failed to associate file to user', {fileId, userId, error: String(assocResult.reason)})
    }

    if (file && file.status == FileStatus.Downloaded) {
      // File already downloaded - send notification to user
      await sendFileNotification(file, userId)
      addMetadata(span, 'action', 'dispatched')
      endSpan(span)
      return {statusCode: 200, status: ResponseStatus.Dispatched}
    } else {
      if (!file) {
        // New file - create Files and FileDownloads records with correlationId
        await addFile(fileId, articleURL, correlationId)
        addMetadata(span, 'newFile', true)
      }
      // Publish DownloadRequested event to EventBridge with retry on transient failures
      // EventBridge routes to DownloadQueue -> StartFileUpload Lambda
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

// Idempotent wrapper for webhook processing
// Lazy initialization to ensure environment variables are available
let idempotentProcessor: ((input: WebhookProcessingInput) => Promise<WebhookProcessingResult>) | null = null
let idempotencyConfig: IdempotencyConfig | null = null

function getIdempotentProcessor() {
  if (!idempotentProcessor) {
    idempotencyConfig = new IdempotencyConfig({})
    idempotentProcessor = makeIdempotent(processWebhookRequest, {
      persistenceStore: createIdempotencyStore(),
      config: idempotencyConfig,
      dataIndexArgument: 0
    })
  }
  return idempotentProcessor
}

const FeedlyWebhookRequestSchema = z.object({
  articleURL: z.string()
})

const api = defineApiHandler({auth: 'authorizer', schema: FeedlyWebhookRequestSchema, operationName: 'WebhookFeedly'})
export const handler = api(async ({context, userId, body, metadata}) => {
  if (!userId) throw new UnauthorizedError('Authentication required')

  // Track webhook received
  metrics.addMetric('WebhookReceived', MetricUnit.Count, 1)

  // Use correlation ID from metadata for end-to-end request tracing
  logInfo('Processing request', {correlationId: metadata.correlationId, traceId: metadata.traceId})

  const fileId = getVideoID(body.articleURL)

  // Register Lambda context for idempotency time tracking
  const processor = getIdempotentProcessor()
  idempotencyConfig?.registerLambdaContext(context)

  // Process webhook with idempotency protection
  const result = await processor({fileId, userId, articleURL: body.articleURL, correlationId: metadata.correlationId})

  // Track webhook processed
  metrics.addMetric('WebhookProcessed', MetricUnit.Count, 1)

  return buildValidatedResponse(context, result.statusCode, {status: result.status as 'Dispatched' | 'Initiated' | 'Accepted'}, webhookResponseSchema)
})
