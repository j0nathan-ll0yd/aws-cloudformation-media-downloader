import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {subscribe} from '../../../lib/vendor/AWS/SNS'
import {UserSubscribe} from '../../../types/main'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {userSubscribeConstraints} from '../../../util/constraints'
import {internalServerErrorResponse, logDebug, logInfo, response, verifyPlatformConfiguration} from '../../../util/lambda-helpers'

/**
 * Subscribes an endpoint (a client device) to an SNS topic
 * @param endpointArn - The EndpointArn of a mobile app and device
 * @param topicArn - The ARN of the topic you want to subscribe to
 * @notExported
 */
async function subscribeEndpointToTopic(endpointArn: string, topicArn: string) {
  const subscribeParams = {
    Endpoint: endpointArn,
    Protocol: 'application',
    TopicArn: topicArn
  }
  logDebug('subscribe <=', subscribeParams)
  const subscribeResponse = await subscribe(subscribeParams)
  logDebug('subscribe =>', subscribeResponse)
  return subscribeResponse
}

/**
 * Subscribes an endpoint (a client device) to an SNS topic
 *
 * - Requires that the platformApplicationArn environment variable is set
 * - Requires the endpointArn and topicArn are in the payload
 *
 * @notExported
 */
export async function handler(event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> {
  logInfo('event <=', event)
  let requestBody
  try {
    verifyPlatformConfiguration()
    requestBody = getPayloadFromEvent(event) as UserSubscribe
    validateRequest(requestBody, userSubscribeConstraints)
  } catch (error) {
    return internalServerErrorResponse(context, error)
  }

  const subscribeResponse = await subscribeEndpointToTopic(requestBody.endpointArn, requestBody.topicArn)
  return response(context, 201, {
    subscriptionArn: subscribeResponse.SubscriptionArn
  })
}
