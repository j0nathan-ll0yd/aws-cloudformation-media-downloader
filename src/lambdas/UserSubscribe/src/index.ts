import type {APIGatewayProxyResult} from 'aws-lambda'
import type {UserSubscribeInput} from '#types/request-types'
import type {AuthenticatedApiParams} from '#types/lambda-wrappers'
import {getPayloadFromEvent, validateRequest} from '#util/apigateway-helpers'
import {userSubscribeSchema} from '#util/constraints'
import {response, verifyPlatformConfiguration, wrapAuthenticatedHandler} from '#util/lambda-helpers'
import {subscribeEndpointToTopic} from '#util/shared'
import {withXRay} from '#lib/vendor/AWS/XRay'

/**
 * Subscribes an endpoint (a client device) to an SNS topic
 *
 * - Requires authentication (rejects Unauthenticated and Anonymous users)
 * - Requires that the platformApplicationArn environment variable is set
 * - Requires the endpointArn and topicArn are in the payload
 *
 * @notExported
 */
export const handler = withXRay(wrapAuthenticatedHandler(async ({event, context}: AuthenticatedApiParams): Promise<APIGatewayProxyResult> => {
  verifyPlatformConfiguration()
  const requestBody = getPayloadFromEvent(event) as UserSubscribeInput
  validateRequest(requestBody, userSubscribeSchema)

  const subscribeResponse = await subscribeEndpointToTopic(requestBody.endpointArn, requestBody.topicArn)
  return response(context, 201, {subscriptionArn: subscribeResponse.SubscriptionArn})
}))
