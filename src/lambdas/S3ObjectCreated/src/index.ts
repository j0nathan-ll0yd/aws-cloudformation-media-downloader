import {S3Event} from 'aws-lambda'
import {scan} from '../../../lib/vendor/AWS/DynamoDB.js'
import {sendMessage} from '../../../lib/vendor/AWS/SQS.js'
import {DynamoDBFile, UserFile} from '../../../types/main'
import {getFileByKey, getUsersByFileId} from '../../../util/dynamodb-helpers.js'
import {logDebug} from '../../../util/lambda-helpers.js'
import {assertIsError, transformDynamoDBFileToSQSMessageBodyAttributeMap} from '../../../util/transformers.js'
import {UnexpectedError} from '../../../util/errors.js'
import {SendMessageRequest} from '@aws-sdk/client-sqs'

/**
 * Returns the DynamoDBFile by file name
 * @param fileName - The name of the DynamoDBFile you're searching for
 * @notExported
 */
async function getFileByFilename(fileName: string): Promise<DynamoDBFile> {
  const getFileByKeyParams = getFileByKey(process.env.DynamoDBTableFiles as string, fileName)
  logDebug('scan <=', getFileByKeyParams)
  const getFileByKeyResponse = await scan(getFileByKeyParams)
  logDebug('scan =>', getFileByKeyResponse)
  if (Array.isArray(getFileByKeyResponse.Items) && getFileByKeyResponse.Items.length > 0) {
    return getFileByKeyResponse.Items[0] as unknown as DynamoDBFile
  } else {
    throw new UnexpectedError('Unable to locate file')
  }
}

/**
 * Returns a array of users who have requested a given file
 * @param file - The DynamoDBFile you want to search for
 * @notExported
 */
async function getUsersOfFile(file: DynamoDBFile): Promise<string[]> {
  const getUsersByFileIdParams = getUsersByFileId(process.env.DynamoDBTableUserFiles as string, file.fileId)
  logDebug('scan <=', getUsersByFileIdParams)
  const getUsersByFileIdResponse = await scan(getUsersByFileIdParams)
  logDebug('scan =>', getUsersByFileIdResponse)
  const userFiles = getUsersByFileIdResponse.Items as unknown as [UserFile]
  return userFiles.map((userDevice) => userDevice.userId)
}

/**
 * Returns a promise to send a DynamoDBFile to a user
 * @param file - The DynamoDBFile you want to send
 * @param userId - The UUID of the user
 * @notExported
 */
function dispatchFileNotificationToUser(file: DynamoDBFile, userId: string) {
  const messageAttributes = transformDynamoDBFileToSQSMessageBodyAttributeMap(file, userId)
  const sendMessageParams = {
    MessageBody: 'FileNotification',
    MessageAttributes: messageAttributes,
    QueueUrl: process.env.SNSQueueUrl
  } as unknown as SendMessageRequest
  logDebug('sendMessage <=', sendMessageParams)
  return sendMessage(sendMessageParams)
}

/**
 * After a File is downloaded, dispatch a notification to all UserDevices
 * @notExported
 */
export async function handler(event: S3Event): Promise<void> {
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
}
