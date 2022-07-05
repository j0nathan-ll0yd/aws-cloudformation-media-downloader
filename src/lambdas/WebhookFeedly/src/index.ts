import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {query, updateItem} from '../../../lib/vendor/AWS/DynamoDB'
import {sendMessage} from '../../../lib/vendor/AWS/SQS'
import {getVideoID} from '../../../lib/vendor/YouTube'
import {DynamoDBFile} from '../../../types/main'
import {Webhook} from '../../../types/vendor/IFTTT/Feedly/Webhook'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {feedlyEventConstraints} from '../../../util/constraints'
import {newFileParams, queryFileParams, userFileParams} from '../../../util/dynamodb-helpers'
import {getUserIdFromEvent, lambdaErrorResponse, logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {transformDynamoDBFileToSQSMessageBodyAttributeMap} from '../../../util/transformers'

/**
 * Adds a base File (just fileId) to DynamoDB
 * @param fileId - The unique file identifier
 * @notExported
 */
async function addFile(fileId) {
  const params = newFileParams(process.env.DynamoDBTableFiles, fileId)
  logDebug('addFile.updateItem <=', params)
  const updateResponse = await updateItem(params)
  logDebug('addFile.updateItem =>', updateResponse)
  return updateResponse
}

/**
 * Associates a File to a User in DynamoDB
 * @param fileId - The unique file identifier
 * @param userId - The UUID of the user
 * @notExported
 */
async function associateFileToUser(fileId, userId) {
  const params = userFileParams(process.env.DynamoDBTableUserFiles, userId, fileId)
  logDebug('associateFileToUser.updateItem <=', params)
  const updateResponse = await updateItem(params)
  logDebug('associateFileToUser.updateItem =>', updateResponse)
  return updateResponse
}

/**
 * Retrieves a File from DynamoDB (if it exists)
 * @param fileId - The unique file identifier
 * @notExported
 */
async function getFile(fileId): Promise<DynamoDBFile | undefined> {
  const fileParams = queryFileParams(process.env.DynamoDBTableFiles, fileId)
  logDebug('getFile.query <=', fileParams)
  const fileResponse = await query(fileParams)
  logDebug('getFile.query =>', fileResponse)
  if (fileResponse.Count === 1) {
    return fileResponse.Items[0] as DynamoDBFile
  }
  return undefined
}

/**
 * Retrieves a File from DynamoDB (if it exists)
 * @param file - A DynamoDB File object
 * @param userId - The UUID of the user
 * @notExported
 */
async function sendFileNotification(file: DynamoDBFile, userId: string) {
  const messageAttributes = transformDynamoDBFileToSQSMessageBodyAttributeMap(file, userId)
  const sendMessageParams = {
    MessageBody: 'FileNotification',
    MessageAttributes: messageAttributes,
    QueueUrl: process.env.SNSQueueUrl
  }
  logDebug('sendMessage <=', sendMessageParams)
  const sendMessageResponse = await sendMessage(sendMessageParams)
  logDebug('sendMessage =>', sendMessageResponse)
  return sendMessageResponse
}

/**
 * Receives a webhook to download a file from Feedly.
 *
 * - If the file already exists: it is associated with the requesting user and a push notification is dispatched.
 * - If the file doesn't exist: it is associated with the requesting user and queued for download.
 *
 * @notExported
 */
export async function handler(event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> {
  logInfo('event <=', event)
  let requestBody
  try {
    requestBody = getPayloadFromEvent(event) as Webhook
    validateRequest(requestBody, feedlyEventConstraints)
    const fileId = getVideoID(requestBody.articleURL)
    const userId = getUserIdFromEvent(event as APIGatewayEvent)
    const file = await getFile(fileId)
    if (file && file.url) {
      // There needs to be a file AND a file url (to indicate it was downloaded)
      // If so, notify the client the file can be downloaded
      await sendFileNotification(file, userId)
      return response(context, 204)
    }
    await Promise.all([addFile(fileId), associateFileToUser(fileId, userId)])
    return response(context, 202, {status: 'Accepted'})
  } catch (error) {
    return lambdaErrorResponse(context, error)
  }
}
