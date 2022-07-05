import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {UserSubscribe} from '../../../types/main'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {userSubscribeConstraints} from '../../../util/constraints'
import {lambdaErrorResponse, logInfo, response, subscribeEndpointToTopic, verifyPlatformConfiguration} from '../../../util/lambda-helpers'

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
    return lambdaErrorResponse(context, error)
  }

  const subscribeResponse = await subscribeEndpointToTopic(requestBody.endpointArn, requestBody.topicArn)
  return response(context, 201, {
    subscriptionArn: subscribeResponse.SubscriptionArn
  })
}
