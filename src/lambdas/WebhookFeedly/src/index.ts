import {randomUUID} from 'node:crypto'
import {Files} from '#entities/Files'
import {DownloadStatus, FileDownloads} from '#entities/FileDownloads'
import {sendMessage} from '#lib/vendor/AWS/SQS'
import type {SendMessageRequest} from '#lib/vendor/AWS/SQS'
import {getVideoID} from '#lib/vendor/YouTube'
import type {File} from '#types/domain-models'
import type {Webhook} from '#types/vendor/IFTTT/Feedly/Webhook'
import {getPayloadFromEvent, validateRequest} from '#util/apigateway-helpers'
import {feedlyEventSchema} from '#util/constraints'
import {buildApiResponse, withPowertools, wrapAuthenticatedHandler} from '#util/lambda-helpers'
import {logDebug, logError, logInfo} from '#util/logging'
import {createDownloadReadyNotification} from '#util/transformers'
import {FileStatus, ResponseStatus} from '#types/enums'
import {initiateFileDownload} from '#util/lambda-invoke-helpers'
import {associateFileToUser} from '#util/user-file-helpers'
import {getRequiredEnv} from '#util/env-validation'
import {makeIdempotent, createPersistenceStore, defaultIdempotencyConfig} from '#lib/vendor/Powertools/idempotency'

/**
 * Adds a base File record to DynamoDB with placeholder metadata.
 * Also creates a FileDownloads record to track the download orchestration.
 *
 * Files = permanent metadata (populated when download succeeds)
 * FileDownloads = transient orchestration state (retries, scheduling)
 *
 * @param fileId - The unique file identifier (YouTube video ID)
 * @param sourceUrl - The original YouTube URL for the video
 * @param correlationId - Correlation ID for end-to-end request tracing
 */
async function addFile(fileId: string, sourceUrl?: string, correlationId?: string) {
  logDebug('addFile <=', {fileId, sourceUrl, correlationId})

  // Create placeholder Files record (will be updated with real metadata on successful download)
  const fileResponse = await Files.create({
    fileId,
    size: 0,
    status: FileStatus.Queued,
    authorName: '',
    authorUser: '',
    publishDate: new Date().toISOString(),
    description: '',
    key: fileId, // Will be updated to include extension
    contentType: '',
    title: ''
  }).go()
  logDebug('addFile Files.create =>', fileResponse)

  // Create FileDownloads record to track download orchestration
  const downloadResponse = await FileDownloads.create({fileId, status: DownloadStatus.Pending, sourceUrl, correlationId}).go()
  logDebug('addFile FileDownloads.create =>', downloadResponse)

  return fileResponse
}

/**
 * Retrieves a File from DynamoDB (if it exists)
 * @param fileId - The unique file identifier
 * @notExported
 */
async function getFile(fileId: string): Promise<File | undefined> {
  logDebug('getFile <=', fileId)
  const fileResponse = await Files.get({fileId}).go()
  logDebug('getFile =>', fileResponse)
  return fileResponse.data as File | undefined
}

/**
 * Sends a DownloadReadyNotification to the user
 * @param file - A DynamoDB File object
 * @param userId - The UUID of the user
 * @notExported
 */
async function sendFileNotification(file: File, userId: string) {
  const {messageBody, messageAttributes} = createDownloadReadyNotification(file, userId)
  const sendMessageParams: SendMessageRequest = {MessageBody: messageBody, MessageAttributes: messageAttributes, QueueUrl: getRequiredEnv('SNSQueueUrl')}
  logDebug('sendMessage <=', sendMessageParams)
  const sendMessageResponse = await sendMessage(sendMessageParams)
  logDebug('sendMessage =>', sendMessageResponse)
  return sendMessageResponse
}

interface WebhookProcessingInput {
  fileId: string
  userId: string
  articleURL: string
  backgroundMode?: boolean
  correlationId: string
}

interface WebhookProcessingResult {
  statusCode: number
  status: ResponseStatus
}

/**
 * Core webhook processing logic - wrapped with idempotency
 * This function handles the actual file processing and returns the result
 * Idempotency ensures duplicate webhook calls return the same response
 */
async function processWebhookRequest(input: WebhookProcessingInput): Promise<WebhookProcessingResult> {
  const {fileId, userId, articleURL, backgroundMode, correlationId} = input

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
    if (!backgroundMode) {
      // Foreground mode - initiate download immediately with correlationId
      await initiateFileDownload(fileId, correlationId)
      return {statusCode: 202, status: ResponseStatus.Initiated}
    } else {
      // Background mode - FileCoordinator will pick it up
      return {statusCode: 202, status: ResponseStatus.Accepted}
    }
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
export const handler = withPowertools(wrapAuthenticatedHandler(async ({event, context, userId}) => {
  // Generate correlation ID for end-to-end request tracing
  const correlationId = randomUUID()
  logInfo('Processing request', {correlationId, requestId: context.awsRequestId})

  const requestBody = getPayloadFromEvent(event) as Webhook
  validateRequest(requestBody, feedlyEventSchema)
  const fileId = getVideoID(requestBody.articleURL)

  // Process webhook with idempotency protection
  const result = await getIdempotentProcessor()({
    fileId,
    userId,
    articleURL: requestBody.articleURL,
    backgroundMode: requestBody.backgroundMode,
    correlationId
  })

  return buildApiResponse(context, result.statusCode, {status: result.status})
}))
