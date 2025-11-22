import {S3Event, Context} from 'aws-lambda'
import {Files} from '../../../lib/vendor/ElectroDB/entities/Files'
import {UserFiles} from '../../../lib/vendor/ElectroDB/entities/UserFiles'
import {sendMessage, SendMessageRequest} from '../../../lib/vendor/AWS/SQS'
import {DynamoDBFile} from '../../../types/main'
import {logDebug} from '../../../util/lambda-helpers'
import {assertIsError, transformDynamoDBFileToSQSMessageBodyAttributeMap} from '../../../util/transformers'
import {UnexpectedError} from '../../../util/errors'
import {withXRay} from '../../../lib/vendor/AWS/XRay'


/**
 * Returns the DynamoDBFile by file name
 * @param fileName - The name of the DynamoDBFile you're searching for
 * @notExported
 */
async function getFileByFilename(fileName: string): Promise<DynamoDBFile> {
  logDebug('scan for file <=', fileName)
  const scanResponse = await Files.scan.where(({key}, {eq}) => eq(key, fileName)).go()
  logDebug('scan for file =>', scanResponse)
  if (scanResponse.data && scanResponse.data.length > 0) {
    return scanResponse.data[0] as DynamoDBFile
  } else {
    throw new UnexpectedError('Unable to locate file')
  }
}

/**
 * Returns an array of user IDs who have requested a given file
 * @param file - The DynamoDBFile you want to search for
 * @notExported
 */
async function getUsersOfFile(file: DynamoDBFile): Promise<string[]> {
  logDebug('scan for users with file <=', file.fileId)
  const scanResponse = await UserFiles.scan.go()
  logDebug('scan for users with file =>', scanResponse)
  const userFiles = scanResponse.data.filter((userFile) => userFile.fileId?.includes(file.fileId))
  return userFiles.map((userFile) => userFile.userId)
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
  } as SendMessageRequest
  logDebug('sendMessage <=', sendMessageParams)
  return sendMessage(sendMessageParams)
}

/**
 * After a File is downloaded, dispatch a notification to all UserDevices
 * @notExported
 */
export const handler = withXRay(async (event: S3Event, _context: Context, {traceId: _traceId}): Promise<void> => {
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
