import {userSubscriptionSchema} from '#types/api-schema'
import type {UserSubscription} from '#types/api-schema'
import {getPayloadFromEvent, validateRequest} from '#lib/lambda/middleware/api-gateway'
import {buildApiResponse} from '#lib/lambda/responses'
import {verifyPlatformConfiguration} from '#lib/lambda/context'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapAuthenticatedHandler} from '#lib/lambda/middleware/api'
import {subscribeEndpointToTopic} from '#lib/domain/device/device-service'

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
  const requestBody = getPayloadFromEvent(event) as UserSubscription
  validateRequest(requestBody, userSubscriptionSchema)

  const subscribeResponse = await subscribeEndpointToTopic(requestBody.endpointArn, requestBody.topicArn)
  return buildApiResponse(context, 201, {subscriptionArn: subscribeResponse.SubscriptionArn})
}))
