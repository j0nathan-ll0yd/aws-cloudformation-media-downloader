import {APIGatewayEvent, Context} from 'aws-lambda'
import {updateItem} from '../../../lib/vendor/AWS/DynamoDB'
import {getVideoID} from '../../../lib/vendor/YouTube'
import {ScheduledEvent} from '../../../types/vendor/Amazon/CloudWatch/ScheduledEvent'
import {Webhook} from '../../../types/vendor/IFTTT/Feedly/Webhook'
import {processEventAndValidate} from '../../../util/apigateway-helpers'
import {feedlyEventConstraints} from '../../../util/constraints'
import {newFileParams, userFileParams} from '../../../util/dynamodb-helpers'
import {getUserIdFromEvent, logDebug, logInfo, response} from '../../../util/lambda-helpers'

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
