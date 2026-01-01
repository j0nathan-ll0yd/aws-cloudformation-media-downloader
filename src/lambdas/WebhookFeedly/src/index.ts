/**
 * WebhookFeedly Lambda
 *
 * Receives Feedly webhook notifications for new YouTube videos.
 * Validates the article URL, creates a file record, and queues for download.
 *
 * Trigger: API Gateway POST /webhooks/feedly
 * Input: FeedlyWebhookRequest with articleURL
 * Output: APIGatewayProxyResult with file metadata
 */
import {createFile, createFileDownload, getFile as getFileRecord} from '#entities/queries'
import {sendMessage} from '#lib/vendor/AWS/SQS'
import type {SendMessageRequest} from '#lib/vendor/AWS/SQS'
import {publishEventWithRetry} from '#lib/vendor/AWS/EventBridge'
import {createPersistenceStore, defaultIdempotencyConfig, makeIdempotent} from '#lib/vendor/Powertools/idempotency'
import {getVideoID} from '#lib/vendor/YouTube'
import {DownloadStatus, FileStatus, ResponseStatus} from '#types/enums'
import {feedlyWebhookRequestSchema, webhookResponseSchema} from '#types/api-schema'
import type {FeedlyWebhookRequest} from '#types/api-schema'
import type {File} from '#types/domain-models'
import type {DownloadRequestedDetail} from '#types/events'
import {getPayloadFromEvent, validateRequest} from '#lib/lambda/middleware/api-gateway'
import {getRequiredEnv} from '#lib/system/env'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapAuthenticatedHandler} from '#lib/lambda/middleware/api'
import {logDebug, logError, logInfo} from '#lib/system/logging'
import {createDownloadReadyNotification} from '#lib/domain/notification/transformers'
import {associateFileToUser} from '#lib/domain/user/user-file-service'

// Add file and download tracking records
async function addFile(fileId: string, sourceUrl?: string, correlationId?: string) {
  logDebug('addFile <=', {fileId, sourceUrl, correlationId})

  // Create placeholder Files record (will be updated with real metadata on successful download)
  const file = await createFile({
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
  logDebug('addFile createFile =>', file)

  // Create FileDownloads record to track download orchestration
  const download = await createFileDownload({fileId, status: DownloadStatus.Pending, sourceUrl, correlationId})
  logDebug('addFile createFileDownload =>', download)

  return file
}

// Get file by ID
async function getFile(fileId: string): Promise<File | undefined> {
  logDebug('getFile <=', fileId)
  const file = await getFileRecord(fileId)
  logDebug('getFile =>', file ?? 'null')
  return file as File | undefined
}

/**
 * Sends a DownloadReadyNotification to the user
 * @param file - A DynamoDB File object
 * @param userId - The UUID of the user
 * @returns The SQS send message response
 * @notExported
 */
async function sendFileNotification(file: File, userId: string) {
  const {messageBody, messageAttributes} = createDownloadReadyNotification(file, userId)
  const sendMessageParams: SendMessageRequest = {MessageBody: messageBody, MessageAttributes: messageAttributes, QueueUrl: getRequiredEnv('SNS_QUEUE_URL')}
  logDebug('sendMessage <=', sendMessageParams)
  const sendMessageResponse = await sendMessage(sendMessageParams)
  logDebug('sendMessage =>', sendMessageResponse)
  return sendMessageResponse
}

interface WebhookProcessingInput {
  fileId: string
  userId: string
  articleURL: string
  correlationId: string
}

interface WebhookProcessingResult {
  statusCode: number
  status: ResponseStatus
}

/**
 * Core webhook processing logic - wrapped with idempotency.
 * This function handles the actual file processing and returns the result.
 * Idempotency ensures duplicate webhook calls return the same response.
 *
 * @param input - The webhook processing input parameters
 * @returns Processing result with status code and response status
 * @notExported
 */
async function processWebhookRequest(input: WebhookProcessingInput): Promise<WebhookProcessingResult> {
  const {fileId, userId, articleURL, correlationId} = input

  // Parallelize independent operations for ~60% latency reduction
  // Use Promise.allSettled to handle partial failures gracefully
  const [assocResult, fileResult] = await Promise.allSettled([associateFileToUser(fileId, userId), getFile(fileId)])
  const file = fileResult.status === 'fulfilled' ? fileResult.value : undefined
  if (assocResult.status === 'rejected') {
    logError('Failed to associate file to user', {fileId, userId, error: assocResult.reason})
  }

  if (file && file.status == FileStatus.Downloaded) {
    // File already downloaded - send notification to user
    await sendFileNotification(file, userId)
    return {statusCode: 200, status: ResponseStatus.Dispatched}
  } else {
    if (!file) {
      // New file - create Files and FileDownloads records with correlationId
      await addFile(fileId, articleURL, correlationId)
    }
    // Publish DownloadRequested event to EventBridge with retry on transient failures
    // EventBridge routes to DownloadQueue -> StartFileUpload Lambda
    const eventDetail: DownloadRequestedDetail = {fileId, userId, sourceUrl: articleURL, correlationId, requestedAt: new Date().toISOString()}
    await publishEventWithRetry('DownloadRequested', eventDetail, {correlationId})
    logInfo('Published DownloadRequested event', {fileId, correlationId})
    return {statusCode: 202, status: ResponseStatus.Accepted}
  }
}

// Idempotent wrapper for webhook processing
// Lazy initialization to ensure environment variables are available
let idempotentProcessor: ((input: WebhookProcessingInput) => Promise<WebhookProcessingResult>) | null = null

function getIdempotentProcessor() {
  if (!idempotentProcessor) {
    idempotentProcessor = makeIdempotent(processWebhookRequest, {
      persistenceStore: createPersistenceStore(),
      config: defaultIdempotencyConfig,
      dataIndexArgument: 0
    })
  }
  return idempotentProcessor
}

/**
 * Receives a webhook to download a file from Feedly.
 *
 * - If the file already exists: it is associated with the requesting user and a push notification is dispatched.
 * - If the file doesn't exist: it is associated with the requesting user and queued for download.
 *
 * Uses Powertools Idempotency to prevent duplicate processing of the same webhook request.
 *
 * @notExported
 */
export const handler = withPowertools(wrapAuthenticatedHandler(async ({event, context, userId, metadata}) => {
  // Use correlation ID from middleware for end-to-end request tracing
  const {correlationId, traceId} = metadata
  logInfo('Processing request', {correlationId, traceId})

  const requestBody = getPayloadFromEvent(event) as FeedlyWebhookRequest
  validateRequest(requestBody, feedlyWebhookRequestSchema)
  const fileId = getVideoID(requestBody.articleURL)

  // Process webhook with idempotency protection
  const result = await getIdempotentProcessor()({fileId, userId, articleURL: requestBody.articleURL, correlationId})

  return buildValidatedResponse(context, result.statusCode, {status: result.status as 'Dispatched' | 'Initiated' | 'Accepted'}, webhookResponseSchema)
}))
