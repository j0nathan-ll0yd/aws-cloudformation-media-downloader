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
import type {APIGatewayProxyResult, Context} from 'aws-lambda'
import {createFile, createFileDownload, getFile as getFileRecord} from '#entities/queries'
import {sendMessage} from '#lib/vendor/AWS/SQS'
import type {SendMessageRequest} from '#lib/vendor/AWS/SQS'
import {publishEventWithRetry} from '#lib/vendor/AWS/EventBridge'
import {addAnnotation, addMetadata, endSpan, startSpan} from '#lib/vendor/OpenTelemetry'
import {createPersistenceStore, defaultIdempotencyConfig, makeIdempotent} from '#lib/vendor/Powertools/idempotency'
import {getVideoID} from '#lib/vendor/YouTube'
import {DatabaseOperation, DatabaseTable} from '#types/databasePermissions'
import {DownloadStatus, FileStatus, ResponseStatus} from '#types/enums'
import {feedlyWebhookRequestSchema, webhookResponseSchema} from '#types/api-schema'
import type {FeedlyWebhookRequest} from '#types/api-schema'
import type {File} from '#types/domainModels'
import type {DownloadRequestedDetail} from '#types/events'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'
import type {WebhookProcessingInput, WebhookProcessingResult} from '#types/lambda'
import {AWSService, EventBridgeOperation, EventBridgeResource, SQSOperation, SQSResource} from '#types/servicePermissions'
import {getPayloadFromEvent, validateRequest} from '#lib/lambda/middleware/apiGateway'
import {getRequiredEnv} from '#lib/system/env'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {AuthenticatedHandler, metrics, MetricUnit, RequiresDatabase, RequiresEventBridge, RequiresServices} from '#lib/lambda/handlers'
import {logDebug, logError, logInfo} from '#lib/system/logging'
import {createDownloadReadyNotification} from '#lib/services/notification/transformers'
import {associateFileToUser} from '#lib/domain/user/userFileService'

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
      logError('Failed to associate file to user', {fileId, userId, error: assocResult.reason})
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
      await publishEventWithRetry('DownloadRequested', eventDetail, {correlationId})
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
 * Handler for Feedly webhook requests.
 * Processes video download requests with idempotency protection.
 */
@RequiresDatabase([
  {table: DatabaseTable.Files, operations: [DatabaseOperation.Select, DatabaseOperation.Insert]},
  {table: DatabaseTable.FileDownloads, operations: [DatabaseOperation.Select, DatabaseOperation.Insert]},
  {table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Select, DatabaseOperation.Insert]}
])
@RequiresServices([
  {service: AWSService.SQS, resource: SQSResource.SendPushNotification, operations: [SQSOperation.SendMessage]},
  {service: AWSService.EventBridge, resource: EventBridgeResource.MediaDownloader, operations: [EventBridgeOperation.PutEvents]}
])
@RequiresEventBridge({publishes: ['DownloadRequested']})
class WebhookFeedlyHandler extends AuthenticatedHandler {
  readonly operationName = 'WebhookFeedly'

  protected async handleAuthenticated(event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> {
    // Track webhook received
    metrics.addMetric('WebhookReceived', MetricUnit.Count, 1)

    // Use correlation ID from base class for end-to-end request tracing
    logInfo('Processing request', {correlationId: this.correlationId, traceId: this.traceId})

    const requestBody = getPayloadFromEvent(event) as FeedlyWebhookRequest
    validateRequest(requestBody, feedlyWebhookRequestSchema)
    const fileId = getVideoID(requestBody.articleURL)

    // Process webhook with idempotency protection
    const result = await getIdempotentProcessor()({fileId, userId: this.userId, articleURL: requestBody.articleURL, correlationId: this.correlationId})

    // Track webhook processed
    metrics.addMetric('WebhookProcessed', MetricUnit.Count, 1)

    return buildValidatedResponse(context, result.statusCode, {status: result.status as 'Dispatched' | 'Initiated' | 'Accepted'}, webhookResponseSchema)
  }
}

const handlerInstance = new WebhookFeedlyHandler()
export const handler = handlerInstance.handler.bind(handlerInstance)
