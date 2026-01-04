/**
 * UserSubscribe Lambda
 *
 * Subscribes user's device endpoint to an SNS topic for push notifications.
 * Requires authenticated user with valid device registration.
 *
 * Trigger: API Gateway POST /user/subscribe
 * Input: UserSubscriptionRequest with endpointArn and topicArn
 * Output: APIGatewayProxyResult with subscription confirmation
 */
import {userSubscriptionRequestSchema} from '#types/api-schema'
import type {UserSubscriptionRequest} from '#types/api-schema'
import {getPayloadFromEvent, validateRequest} from '#lib/lambda/middleware/apiGateway'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {verifyPlatformConfiguration} from '#lib/lambda/context'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapAuthenticatedHandler} from '#lib/lambda/middleware/api'
import {subscribeEndpointToTopic} from '#lib/domain/device/deviceService'

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
  const requestBody = getPayloadFromEvent(event) as UserSubscriptionRequest
  validateRequest(requestBody, userSubscriptionRequestSchema)

  const subscribeResponse = await subscribeEndpointToTopic(requestBody.endpointArn, requestBody.topicArn)
  return buildValidatedResponse(context, 201, {subscriptionArn: subscribeResponse.SubscriptionArn})
}))
