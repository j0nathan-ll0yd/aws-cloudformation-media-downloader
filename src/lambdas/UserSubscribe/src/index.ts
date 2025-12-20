import {getPayloadFromEvent, validateRequest} from '#util/apigateway-helpers'
import {userSubscribeSchema} from '#util/constraints'
import {buildApiResponse, verifyPlatformConfiguration, withPowertools, wrapAuthenticatedHandler} from '#util/lambda-helpers'
import {subscribeEndpointToTopic} from '#util/device-helpers'

interface UserSubscribeInput {
  endpointArn: string
  topicArn: string
}

/**
 * Subscribes an endpoint (a client device) to an SNS topic
 *
 * - Requires authentication (rejects Unauthenticated and Anonymous users)
 * - Requires that the platformApplicationArn environment variable is set
 * - Requires the endpointArn and topicArn are in the payload
 *
 * @notExported
 */
export const handler = withPowertools(wrapAuthenticatedHandler(async ({event, context}) => {
  verifyPlatformConfiguration()
  const requestBody = getPayloadFromEvent(event) as UserSubscribeInput
  validateRequest(requestBody, userSubscribeSchema)

  const subscribeResponse = await subscribeEndpointToTopic(requestBody.endpointArn, requestBody.topicArn)
  return buildApiResponse(context, 201, {subscriptionArn: subscribeResponse.SubscriptionArn})
}))
