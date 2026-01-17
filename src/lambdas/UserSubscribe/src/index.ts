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
import type {APIGatewayProxyResult, Context} from 'aws-lambda'
import {userSubscriptionRequestSchema} from '#types/api-schema'
import type {UserSubscriptionRequest} from '#types/api-schema'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'
import {AuthenticatedHandler} from '#lib/lambda/handlers'
import {getPayloadFromEvent, validateRequest} from '#lib/lambda/middleware/apiGateway'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {verifyPlatformConfiguration} from '#lib/lambda/context'
import {subscribeEndpointToTopic} from '#lib/services/device/deviceService'

/**
 * Handler for user subscription to SNS topics
 * Subscribes an endpoint (a client device) to an SNS topic
 */
class UserSubscribeHandler extends AuthenticatedHandler {
  readonly operationName = 'UserSubscribe'

  protected async handleAuthenticated(event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> {
    verifyPlatformConfiguration()
    const requestBody = getPayloadFromEvent(event) as UserSubscriptionRequest
    validateRequest(requestBody, userSubscriptionRequestSchema)
    this.addAnnotation('endpointArn', requestBody.endpointArn)
    this.addAnnotation('topicArn', requestBody.topicArn)

    const subscribeResponse = await subscribeEndpointToTopic(requestBody.endpointArn, requestBody.topicArn)

    this.addMetadata('subscriptionArn', subscribeResponse.SubscriptionArn)
    return buildValidatedResponse(context, 201, {subscriptionArn: subscribeResponse.SubscriptionArn})
  }
}

const handlerInstance = new UserSubscribeHandler()
export const handler = handlerInstance.handler.bind(handlerInstance)
