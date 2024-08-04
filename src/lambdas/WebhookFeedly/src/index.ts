import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {query, updateItem} from '../../../lib/vendor/AWS/DynamoDB.js'
import {sendMessage} from '../../../lib/vendor/AWS/SQS.js'
import {getVideoID} from '../../../lib/vendor/YouTube.js'
import {DynamoDBFile} from '../../../types/main'
import {Webhook} from '../../../types/vendor/IFTTT/Feedly/Webhook'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers.js'
import {feedlyEventConstraints} from '../../../util/constraints.js'
import {newFileParams, queryFileParams, userFileParams} from '../../../util/dynamodb-helpers.js'
import {getUserDetailsFromEvent, lambdaErrorResponse, logDebug, logInfo, response} from '../../../util/lambda-helpers.js'
import {transformDynamoDBFileToSQSMessageBodyAttributeMap} from '../../../util/transformers.js'
import {SendMessageRequest} from '@aws-sdk/client-sqs'
import {FileStatus} from '../../../types/enums.js'
import {initiateFileDownload} from '../../../util/shared.js'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors.js'

/**
 * Associates a File to a User in DynamoDB
 * @param fileId - The unique file identifier
 * @param userId - The UUID of the user
 */
export async function associateFileToUser(fileId: string, userId: string) {
  const params = userFileParams(process.env.DynamoDBTableUserFiles as string, userId, fileId)
  logDebug('associateFileToUser.updateItem <=', params)
  const updateResponse = await updateItem(params)
  logDebug('associateFileToUser.updateItem =>', updateResponse)
  return updateResponse
}

/**
 * Adds a base File (just fileId) to DynamoDB
 * @param fileId - The unique file identifier
 * @notExported
 */
async function addFile(fileId: string) {
  const params = newFileParams(process.env.DynamoDBTableFiles as string, fileId)
  logDebug('addFile.updateItem <=', params)
  const updateResponse = await updateItem(params)
  logDebug('addFile.updateItem =>', updateResponse)
  return updateResponse
}

/**
 * Retrieves a File from DynamoDB (if it exists)
 * @param fileId - The unique file identifier
 * @notExported
 */
async function getFile(fileId: string): Promise<DynamoDBFile | undefined> {
  const fileParams = queryFileParams(process.env.DynamoDBTableFiles as string, fileId)
  logDebug('getFile.query <=', fileParams)
  const fileResponse = await query(fileParams)
  logDebug('getFile.query =>', fileResponse)
  if (fileResponse.Items && fileResponse.Items.length > 0) {
    return fileResponse.Items[0] as unknown as DynamoDBFile
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
  } as unknown as SendMessageRequest
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
    const {userId} = getUserDetailsFromEvent(event as APIGatewayEvent)
    if (!userId) {
      // This should never happen; handled by API Gateway
      throw new UnexpectedError(providerFailureErrorMessage)
    }
    // Associate the user with the file; regardless of FileStatus
    await associateFileToUser(fileId, userId)
    // Check to see if the file already exists
    const file = await getFile(fileId)
    if (file && file.status == FileStatus.Downloaded) {
      // If the file already exists, trigger the download on the user's device
      await sendFileNotification(file, userId)
      return response(context, 200, {status: 'Dispatched'})
    } else {
      await addFile(fileId)
      if (!requestBody.backgroundMode) {
        await initiateFileDownload(fileId)
        return response(context, 202, {status: 'Initiated'})
      } else {
        return response(context, 202, {status: 'Accepted'})
      }
    }
  } catch (error) {
    return lambdaErrorResponse(context, error)
  }
}
