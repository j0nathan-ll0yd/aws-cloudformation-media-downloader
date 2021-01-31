import {APIGatewayEvent, Context} from 'aws-lambda'
import {batchGet, query} from '../../../lib/vendor/AWS/DynamoDB'
import {ScheduledEvent} from '../../../types/vendor/Amazon/CloudWatch/ScheduledEvent'
import {processEventAndValidate} from '../../../util/apigateway-helpers'
import {getBatchFilesParams, getUserFilesParams} from '../../../util/dynamodb-helpers'
import {getUserIdFromEvent, logDebug, logInfo, response} from '../../../util/lambda-helpers'

export async function listFiles(event: APIGatewayEvent | ScheduledEvent, context: Context) {
  logInfo('event <=', event)
  const {statusCode, message} = processEventAndValidate(event)
  if (statusCode && message) {
    return response(context, statusCode, message)
  }
  try {
    const myResponse = { contents: [], keyCount: 0 }
    const userId = getUserIdFromEvent(event as APIGatewayEvent)
    const userFileParams = getUserFilesParams(process.env.DynamoTableUserFiles, userId)
    logDebug('query <=', userFileParams)
    const userFilesResponse = await query(userFileParams)
    logDebug('query =>', userFilesResponse)
    if (userFilesResponse.Count > 0) {
      const fileParams = getBatchFilesParams(process.env.DynamoTableFiles, userFilesResponse.Items[0].fileId.values)
      logDebug('query <=', fileParams)
      const fileResponse = await batchGet(fileParams)
      logDebug('query =>', fileResponse)
      myResponse.contents = fileResponse.Responses[process.env.DynamoTableFiles].filter(file => file.url)
      myResponse.keyCount = myResponse.contents.length
    }
    return response(context, 200, myResponse)
  } catch (error) {
    throw new Error(error)
  }
}
