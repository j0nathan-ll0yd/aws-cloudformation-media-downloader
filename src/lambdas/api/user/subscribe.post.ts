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
import {buildValidatedResponse} from '@mantleframework/core'
import {UnauthorizedError} from '@mantleframework/errors'
import {defineApiHandler, z} from '@mantleframework/validation'
import {subscribeEndpointToTopic} from '#services/device/deviceService'
import {verifyPlatformConfiguration} from '#utils/platform-config'

const SubscriptionRequestSchema = z.object({
  endpointArn: z.string(),
  topicArn: z.string()
})

const api = defineApiHandler({auth: 'authorizer', schema: SubscriptionRequestSchema, operationName: 'UserSubscribe'})
export const handler = api(async ({context, userId, body}) => {
  if (!userId) throw new UnauthorizedError('Authentication required')

  verifyPlatformConfiguration()

  const subscribeResponse = await subscribeEndpointToTopic(body.endpointArn, body.topicArn)

  return buildValidatedResponse(context, 201, {subscriptionArn: subscribeResponse.SubscriptionArn})
})
