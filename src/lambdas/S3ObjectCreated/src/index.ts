import {S3Event} from 'aws-lambda'
import {scan} from '../../../lib/vendor/AWS/DynamoDB'
import {sendMessage} from '../../../lib/vendor/AWS/SQS'
import {DynamoDBFile, UserFile} from '../../../types/main'
import {getFileByKey, getUsersByFileId} from '../../../util/dynamodb-helpers'
import {logDebug} from '../../../util/lambda-helpers'
import {transformDynamoDBFileToSQSMessageBodyAttributeMap} from '../../../util/transformers'

async function getFileByFilename(fileName: string): Promise<DynamoDBFile> {
  const getFileByKeyParams = getFileByKey(process.env.DynamoDBTableFiles, fileName)
  logDebug('scan <=', getFileByKeyParams)
  const getFileByKeyResponse = await scan(getFileByKeyParams)
  logDebug('scan =>', getFileByKeyResponse)
  if (getFileByKeyResponse.Count === 0) {
    throw 'Unable to locate file'
  }
  return getFileByKeyResponse.Items[0] as DynamoDBFile
}

async function getUsersOfFile(file: DynamoDBFile): Promise<string[]> {
  const getUsersByFileIdParams = getUsersByFileId(process.env.DynamoDBTableUserFiles, file.fileId)
  logDebug('scan <=', getUsersByFileIdParams)
  const getUsersByFileIdResponse = await scan(getUsersByFileIdParams)
  logDebug('scan =>', getUsersByFileIdResponse)
  const userFiles = getUsersByFileIdResponse.Items as [UserFile]
  return userFiles.map((userDevice) => userDevice.userId)
}

function dispatchFileNotificationToUser(file: DynamoDBFile, userId: string) {
  const messageAttributes = transformDynamoDBFileToSQSMessageBodyAttributeMap(file, userId)
  const sendMessageParams = {
    MessageBody: 'FileNotification',
    MessageAttributes: messageAttributes,
    QueueUrl: process.env.SNSQueueUrl
  }
  logDebug('sendMessage <=', sendMessageParams)
  return sendMessage(sendMessageParams)
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function fileUploadWebhook(event: S3Event) {
  logDebug('event', event)
  try {
    const record = event.Records[0]
    const fileName = decodeURIComponent(record.s3.object.key).replace(/\+/g, ' ')
    const file = await getFileByFilename(fileName)
    const userIds = await getUsersOfFile(file)
    const notifications = userIds.map((userId) => dispatchFileNotificationToUser(file, userId))
    await Promise.all(notifications)
  } catch (error) {
    throw new Error(error)
  }
}
