import type {S3EventRecord} from 'aws-lambda'
import {Files} from '#entities/Files'
import {UserFiles} from '#entities/UserFiles'
import {EventType, publishEvent} from '#lib/vendor/AWS/EventBridge'
import type {FileUploadedEvent} from '#lib/vendor/AWS/EventBridge'
import {sendMessage} from '#lib/vendor/AWS/SQS'
import type {SendMessageRequest} from '#lib/vendor/AWS/SQS'
import type {File} from '#types/domain-models'
import type {EventHandlerParams} from '#types/lambda-wrappers'
import {s3Records, withPowertools, wrapEventHandler} from '#util/lambda-helpers'
import {logDebug, logError} from '#util/logging'
import {createDownloadReadyNotification} from '#util/transformers'
import {UnexpectedError} from '#util/errors'
import {getRequiredEnv} from '#util/env-validation'

/**
 * Returns the DynamoDBFile by S3 object key using KeyIndex GSI
 * @param fileName - The S3 object key to search for
 * @notExported
 */
async function getFileByFilename(fileName: string): Promise<File> {
  logDebug('query file by key <=', fileName)
  const queryResponse = await Files.query.byKey({key: fileName}).go()
  logDebug('query file by key =>', queryResponse)
  if (queryResponse.data && queryResponse.data.length > 0) {
    return queryResponse.data[0] as File
  } else {
    throw new UnexpectedError('Unable to locate file')
  }
}

/**
 * Returns an array of user IDs who have requested a given file
 * Uses FileCollection GSI for efficient reverse lookup (eliminates full table scan)
 * @param file - The DynamoDBFile you want to search for
 * @notExported
 */
async function getUsersOfFile(file: File): Promise<string[]> {
  logDebug('query users by fileId <=', file.fileId)
  const queryResponse = await UserFiles.query.byFile({fileId: file.fileId}).go()
  logDebug('query users by fileId =>', queryResponse)
  if (!queryResponse.data || queryResponse.data.length === 0) {
    return []
  }
  return queryResponse.data.map((userFile) => userFile.userId)
}

/**
 * Dispatches DownloadReadyNotification to a user via SQS
 * @param file - The DynamoDBFile that is now ready to download
 * @param userId - The UUID of the user
 * @notExported
 */
function dispatchFileNotificationToUser(file: File, userId: string) {
  const {messageBody, messageAttributes} = createDownloadReadyNotification(file, userId)
  const sendMessageParams: SendMessageRequest = {MessageBody: messageBody, MessageAttributes: messageAttributes, QueueUrl: getRequiredEnv('SNS_QUEUE_URL')}
  logDebug('sendMessage <=', sendMessageParams)
  return sendMessage(sendMessageParams)
}

/**
 * Process a single S3 record - dispatch notifications to all users of the file
 * and publish FileUploaded event to EventBridge for downstream consumers
 * @notExported
 */
async function processS3Record({record}: EventHandlerParams<S3EventRecord>): Promise<void> {
  const fileName = decodeURIComponent(record.s3.object.key).replace(/\+/g, ' ')
  const file = await getFileByFilename(fileName)

  // Publish FileUploaded event to EventBridge for downstream consumers (e.g., Sync Engine)
  const eventDetail: FileUploadedEvent = {fileId: file.fileId, s3Key: file.key, fileSize: file.size, contentType: file.contentType}
  const eventResult = await publishEvent(EventType.FileUploaded, eventDetail)
  if (eventResult.some((entry) => entry.ErrorCode)) {
    logError('Failed to publish FileUploaded event', {fileId: file.fileId, entries: eventResult})
  }
  logDebug('Published FileUploaded event', {fileId: file.fileId})

  // Dispatch notifications to all users waiting for this file
  const userIds = await getUsersOfFile(file)
  // Use allSettled to continue processing even if some notifications fail
  await Promise.allSettled(userIds.map((userId) => dispatchFileNotificationToUser(file, userId)))
}

/**
 * After a File is downloaded, dispatch a notification to all UserDevices
 * @notExported
 */
export const handler = withPowertools(wrapEventHandler(processS3Record, {getRecords: s3Records}))
