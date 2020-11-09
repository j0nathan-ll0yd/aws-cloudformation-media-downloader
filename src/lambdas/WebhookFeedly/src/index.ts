import {APIGatewayEvent, Context} from 'aws-lambda'
import {updateItem} from '../../../lib/vendor/AWS/DynamoDB'
import {getVideoID} from '../../../lib/vendor/YouTube'
import {ScheduledEvent} from '../../../types/vendor/Amazon/CloudWatch/ScheduledEvent'
import {Webhook} from '../../../types/vendor/IFTTT/Feedly/Webhook'
import {processEventAndValidate} from '../../../util/apigateway-helpers'
import {feedlyEventConstraints} from '../../../util/constraints'
import {newFileParams} from '../../../util/dynamodb-helpers'
import {logDebug, logInfo, response} from '../../../util/lambda-helpers'

export async function handleFeedlyEvent(event: APIGatewayEvent | ScheduledEvent, context: Context) {
  logInfo('event <=', event)
  const {requestBody, statusCode, message} = processEventAndValidate(event, feedlyEventConstraints)
  if (statusCode && message) {
    return response(context, statusCode, message)
  }
  try {
    const body = (requestBody as Webhook)
    const fileId = await getVideoID(body.articleURL)
    const updateItemParams = newFileParams(process.env.DynamoDBTable, fileId)
    logDebug('updateItem <=', updateItemParams)
    const updateItemResponse = await updateItem(updateItemParams)
    logDebug('updateItem =>', updateItemResponse)
    if (updateItemResponse.Attributes && updateItemResponse.Attributes.hasOwnProperty('fileName')) {
      return response(context, 204)
    } else {
      return response(context, 202, {status: 'Accepted'})
    }
  } catch (error) {
    return response(context, 500, error.message)
  }
}
