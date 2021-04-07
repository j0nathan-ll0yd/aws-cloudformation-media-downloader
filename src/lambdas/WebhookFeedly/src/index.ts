import {APIGatewayEvent, Context} from 'aws-lambda'
import {query, updateItem} from '../../../lib/vendor/AWS/DynamoDB'
import {sendMessage} from '../../../lib/vendor/AWS/SQS'
import {getVideoID} from '../../../lib/vendor/YouTube'
import {DynamoDBFile} from '../../../types/main'
import {ScheduledEvent} from '../../../types/vendor/Amazon/CloudWatch/ScheduledEvent'
import {Webhook} from '../../../types/vendor/IFTTT/Feedly/Webhook'
import {processEventAndValidate} from '../../../util/apigateway-helpers'
import {feedlyEventConstraints} from '../../../util/constraints'
import {newFileParams, queryFileParams, userFileParams} from '../../../util/dynamodb-helpers'
import {getUserIdFromEvent, logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {transformDynamoDBFileToSQSMessageBodyAttributeMap} from '../../../util/transformers'

async function addFile(fileId) {
  const params = newFileParams(process.env.DynamoDBTableFiles, fileId)
  logDebug('updateItem <=', params)
  const updateResponse = await updateItem(params)
  logDebug('updateItem =>', updateResponse)
  return updateResponse
}

async function associateFileToUser(fileId, userId) {
  const params = userFileParams(process.env.DynamoDBTableUserFiles, userId, fileId)
  logDebug('updateItem <=', params)
  const updateResponse = await updateItem(params)
  logDebug('updateItem =>', updateResponse)
  return updateResponse
}

async function getFile(fileId): Promise<DynamoDBFile | undefined> {
  const fileParams = queryFileParams(process.env.DynamoDBTableFiles, fileId)
  logDebug('query <=', fileParams)
  const fileResponse = await query(fileParams)
  logDebug('query =>', fileResponse)
  if (fileResponse.Count === 1) {
    return fileResponse.Items[0] as DynamoDBFile
  }
  return undefined
}

export async function handleFeedlyEvent(event: APIGatewayEvent | ScheduledEvent, context: Context) {
  logInfo('event <=', event)
  const {requestBody, statusCode, message} = processEventAndValidate(event, feedlyEventConstraints)
  if (statusCode && message) {
    return response(context, statusCode, message)
  }
  try {
    const body = (requestBody as Webhook)
    const fileId = await getVideoID(body.articleURL)
    const userId = getUserIdFromEvent(event as APIGatewayEvent)
    // TODO: Check if file exists before adding; then either add it or just notify the client it can be downloaded
    const file = await getFile(fileId)
    if (file) {
      const messageAttributes = transformDynamoDBFileToSQSMessageBodyAttributeMap(file)
      const sendMessageParams = {
        MessageBody: 'FileNotification',
        MessageAttributes: messageAttributes,
        QueueUrl: process.env.SNSQueueUrl
      }
      logDebug('sendMessage <=', sendMessageParams)
      const sendMessageResponse = await sendMessage(sendMessageParams)
      logDebug('sendMessage =>', sendMessageResponse)
      return response(context, 204)
    }
    const addFilePromise = addFile(fileId)
    const associateFilePromise = associateFileToUser(fileId, userId)
    const results = await Promise.all([addFilePromise, associateFilePromise])
    const addFileResponse = results[0]
    if (addFileResponse.Attributes && addFileResponse.Attributes.hasOwnProperty('fileName')) {
      return response(context, 204)
    } else {
      return response(context, 202, {status: 'Accepted'})
    }
  } catch (error) {
    return response(context, 500, error.message)
  }
}
