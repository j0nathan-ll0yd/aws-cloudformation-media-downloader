import {S3Event} from 'aws-lambda'
import {Files} from '../../../entities/Files'
import {UserFiles} from '../../../entities/UserFiles'
import {sendMessage, SendMessageRequest} from '../../../lib/vendor/AWS/SQS'
import {DynamoDBFile} from '../../../types/main'
import {logDebug} from '../../../util/lambda-helpers'
import {assertIsError, createFileNotificationAttributes} from '../../../util/transformers'
import {UnexpectedError} from '../../../util/errors'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

/**
 * Returns the DynamoDBFile by S3 object key using KeyIndex GSI
 * @param fileName - The S3 object key to search for
 * @notExported
 */
async function getFileByFilename(fileName: string): Promise<DynamoDBFile> {
  logDebug('query file by key <=', fileName)
  const queryResponse = await Files.query.byKey({ key: fileName }).go()
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
  const queryResponse = await UserFiles.query.byFile({ fileId: file.fileId }).go()
  logDebug('query users by fileId =>', queryResponse)
  if (!queryResponse.data || queryResponse.data.length === 0) {
    return []
  }
  return queryResponse.data.map((userFile) => userFile.userId)
}

/**
 * Returns a promise to send a DynamoDBFile to a user
 * @param file - The DynamoDBFile you want to send
 * @param userId - The UUID of the user
 * @notExported
 */
function dispatchFileNotificationToUser(file: DynamoDBFile, userId: string) {
  const messageAttributes = createFileNotificationAttributes(file, userId)
  const sendMessageParams = {
    MessageBody: 'FileNotification',
    MessageAttributes: messageAttributes,
    QueueUrl: process.env.SNSQueueUrl
  } as SendMessageRequest
  logDebug('sendMessage <=', sendMessageParams)
  return sendMessage(sendMessageParams)
}

/**
 * After a File is downloaded, dispatch a notification to all UserDevices
 * @notExported
 */
export const handler = withXRay(async (event: S3Event): Promise<void> => {
  logDebug('event', event)
  try {
    const record = event.Records[0]
    const fileName = decodeURIComponent(record.s3.object.key).replace(/\+/g, ' ')
    const file = await getFileByFilename(fileName)
    const userIds = await getUsersOfFile(file)
    const notifications = userIds.map((userId) => dispatchFileNotificationToUser(file, userId))
    await Promise.all(notifications)
  } catch (error) {
    assertIsError(error)
    throw new UnexpectedError(error.message)
  }
})
