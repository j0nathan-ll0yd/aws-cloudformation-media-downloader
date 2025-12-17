import {S3EventRecord} from 'aws-lambda'
import {Files} from '#entities/Files'
import {UserFiles} from '#entities/UserFiles'
import {sendMessage, SendMessageRequest} from '#lib/vendor/AWS/SQS'
import {DynamoDBFile} from '#types/main'
import {EventHandlerParams, logDebug, s3Records, wrapEventHandler} from '#util/lambda-helpers'
import {createDownloadReadyNotification} from '#util/transformers'
import {UnexpectedError} from '#util/errors'
import {withXRay} from '#lib/vendor/AWS/XRay'
import {getRequiredEnv} from '#util/env-validation'

/**
 * Returns the DynamoDBFile by S3 object key using KeyIndex GSI
 * @param fileName - The S3 object key to search for
 * @notExported
 */
async function getFileByFilename(fileName: string): Promise<DynamoDBFile> {
  logDebug('query file by key <=', fileName)
  const queryResponse = await Files.query.byKey({key: fileName}).go()
  logDebug('query file by key =>', queryResponse)
  if (queryResponse.data && queryResponse.data.length > 0) {
    return queryResponse.data[0] as DynamoDBFile
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
async function getUsersOfFile(file: DynamoDBFile): Promise<string[]> {
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
function dispatchFileNotificationToUser(file: DynamoDBFile, userId: string) {
  const {messageBody, messageAttributes} = createDownloadReadyNotification(file, userId)
  const sendMessageParams: SendMessageRequest = {
    MessageBody: messageBody,
    MessageAttributes: messageAttributes,
    QueueUrl: getRequiredEnv('SNSQueueUrl')
  }
  logDebug('sendMessage <=', sendMessageParams)
  return sendMessage(sendMessageParams)
}

/**
 * Process a single S3 record - dispatch notifications to all users of the file
 * @notExported
 */
async function processS3Record({record}: EventHandlerParams<S3EventRecord>): Promise<void> {
  const fileName = decodeURIComponent(record.s3.object.key).replace(/\+/g, ' ')
  const file = await getFileByFilename(fileName)
  const userIds = await getUsersOfFile(file)
  // Use allSettled to continue processing even if some notifications fail
  await Promise.allSettled(userIds.map((userId) => dispatchFileNotificationToUser(file, userId)))
}

/**
 * After a File is downloaded, dispatch a notification to all UserDevices
 * @notExported
 */
export const handler = withXRay(wrapEventHandler(processS3Record, {getRecords: s3Records}))
