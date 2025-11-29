import {
  APIGatewayProxyResult,
  Context
} from 'aws-lambda'
import {
  CustomAPIGatewayRequestAuthorizerEvent,
  UserSubscribe
} from '../../../types/main'
import {
  getPayloadFromEvent,
  validateRequest
} from '../../../util/apigateway-helpers'
import {userSubscribeSchema} from '../../../util/constraints'
import {
  lambdaErrorResponse,
  logIncomingFixture,
  logOutgoingFixture,
  response,
  verifyPlatformConfiguration
} from '../../../util/lambda-helpers'
import {subscribeEndpointToTopic} from '../../../util/shared'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

/**
 * Subscribes an endpoint (a client device) to an SNS topic
 *
 * - Requires that the platformApplicationArn environment variable is set
 * - Requires the endpointArn and topicArn are in the payload
 *
 * @notExported
 */
export const handler = withXRay(
  async (
    event: CustomAPIGatewayRequestAuthorizerEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> => {
    logIncomingFixture(event)
    let requestBody
    try {
      verifyPlatformConfiguration()
      requestBody = getPayloadFromEvent(event) as UserSubscribe
      validateRequest(requestBody, userSubscribeSchema)
    } catch (error) {
      const errorResult = lambdaErrorResponse(context, error)
      logOutgoingFixture(errorResult)
      return errorResult
    }

    const subscribeResponse = await subscribeEndpointToTopic(
      requestBody.endpointArn,
      requestBody.topicArn
    )
    const successResult = response(context, 201, {
      subscriptionArn: subscribeResponse.SubscriptionArn
    })
    logOutgoingFixture(successResult)
    return successResult
  }
)
