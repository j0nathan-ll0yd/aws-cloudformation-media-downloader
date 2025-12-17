import {APIGatewayProxyResult} from 'aws-lambda'
import {UserSubscribe} from '#types/main'
import type {ApiHandlerParams} from '#types/lambda-wrappers'
import {getPayloadFromEvent, validateRequest} from '#util/apigateway-helpers'
import {userSubscribeSchema} from '#util/constraints'
import {response, verifyPlatformConfiguration, wrapApiHandler} from '#util/lambda-helpers'
import {subscribeEndpointToTopic} from '#util/shared'
import {withXRay} from '#lib/vendor/AWS/XRay'

/**
 * Subscribes an endpoint (a client device) to an SNS topic
 *
 * - Requires that the platformApplicationArn environment variable is set
 * - Requires the endpointArn and topicArn are in the payload
 *
 * @notExported
 */
export const handler = withXRay(wrapApiHandler(async ({event, context}: ApiHandlerParams): Promise<APIGatewayProxyResult> => {
  verifyPlatformConfiguration()
  const requestBody = getPayloadFromEvent(event) as UserSubscribe
  validateRequest(requestBody, userSubscribeSchema)

  const subscribeResponse = await subscribeEndpointToTopic(requestBody.endpointArn, requestBody.topicArn)
  return response(context, 201, {subscriptionArn: subscribeResponse.SubscriptionArn})
}))
