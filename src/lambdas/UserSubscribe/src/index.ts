import { APIGatewayEvent, APIGatewayProxyResult, Context } from 'aws-lambda'
import { subscribe } from '../../../lib/vendor/AWS/SNS'
import { UserSubscribe } from '../../../types/main'
import { getPayloadFromEvent, validateRequest } from '../../../util/apigateway-helpers'
import { userSubscribeConstraints } from '../../../util/constraints'
import { ValidationError } from '../../../util/errors'
import { logDebug, logInfo, response } from '../../../util/lambda-helpers'

export async function index(event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> {
  logInfo('event <=', event)
  let requestBody
  try {
    requestBody = getPayloadFromEvent(event) as UserSubscribe
    const platformApplicationArn = process.env.PlatformApplicationArn
    logInfo('process.env.PlatformApplicationArn <=', platformApplicationArn)
    if (!platformApplicationArn) {
      throw new ValidationError('requires configuration', 500)
    }
    validateRequest(requestBody, userSubscribeConstraints)
  } catch (error) {
    logDebug('error', JSON.stringify(error))
    return response(context, error.statusCode, error.message)
  }
  const subscribeParams = {
    Endpoint: requestBody.endpoint,
    Protocol: 'application',
    TopicArn: process.env.PushNotificationTopicArn
  }
  logDebug('subscribe <=', subscribeParams)
  const subscribeResponse = await subscribe(subscribeParams)
  logDebug('subscribe =>', subscribeResponse)

  return response(context, 201, {
    subscriptionArn: subscribeResponse.SubscriptionArn
  })
}
