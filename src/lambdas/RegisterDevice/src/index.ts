import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {updateItem} from '../../../lib/vendor/AWS/DynamoDB'
import {createPlatformEndpoint, listSubscriptionsByTopic, unsubscribe} from '../../../lib/vendor/AWS/SNS'
import {CustomAPIGatewayRequestAuthorizerEvent, Device, DeviceRegistrationRequest} from '../../../types/main'
import {UserStatus} from '../../../types/enums'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {registerDeviceSchema} from '../../../util/constraints'
import {upsertDeviceParams, userDevicesParams} from '../../../util/dynamodb-helpers'
import {getUserDetailsFromEvent, lambdaErrorResponse, logDebug, logInfo, response, verifyPlatformConfiguration} from '../../../util/lambda-helpers'
import {providerFailureErrorMessage, UnauthorizedError, UnexpectedError} from '../../../util/errors'
import {getUserDevices, subscribeEndpointToTopic} from '../../../util/shared'

/**
 * An idempotent operation that creates an endpoint for a device on one of the supported services (e.g. GCP, APNS)
 * @param token - The client device token
 * @notExported
 */
async function createPlatformEndpointFromToken(token: string) {
  // An idempotent option that creates an endpoint for a device on one of the supported services (e.g. GCP, APNS)
  const params = {
    PlatformApplicationArn: process.env.PlatformApplicationArn as string,
    Token: token
  }
  logDebug('createPlatformEndpoint <=', params)
  const createPlatformEndpointResponse = await createPlatformEndpoint(params)
  if (!createPlatformEndpointResponse) {
    throw new UnexpectedError('AWS failed to respond')
  }
  logDebug('createPlatformEndpoint =>', createPlatformEndpointResponse)
  return createPlatformEndpointResponse
}

/**
 * Unsubscribes an endpoint (a client device) to an SNS topic
 * @param subscriptionArn - The SubscriptionArn of an endpoint+topic
 */
export async function unsubscribeEndpointToTopic(subscriptionArn: string) {
  logDebug('unsubscribeEndpointToTopic <=')
  const response = await unsubscribe({SubscriptionArn: subscriptionArn})
  logDebug('unsubscribeEndpointToTopic =>', response)
  return response
}

/**
 * Store the device details associated with the user (e.g. iPhone, Android) and stores it to DynamoDB
 * @param table - The DynamoDB table to perform the operation on
 * @param userId - The userId
 * @param deviceId - The UUID of the device (either iOS or Android)
 * @notExported
 */
async function upsertUserDevices(table: string, userId: string, deviceId: string) {
  const params = userDevicesParams(table, userId, deviceId)
  logDebug('upsertUserDevices <=', params)
  const response = await updateItem(params)
  logDebug('upsertUserDevices =>', params)
  return response
}

/**
 * Store the device details independent of the user (e.g. iPhone, Android) and stores it to DynamoDB
 * @param table - The DynamoDB table to perform the operation on
 * @param device - The Device details (e.g. endpointArn)
 * @notExported
 */
async function upsertDevice(table: string, device: Device) {
  const params = upsertDeviceParams(table, device)
  logDebug('upsertDevice <=', params)
  const response = await updateItem(params)
  logDebug('upsertDevice =>', params)
  return response
}

/**
 * Store the device details associated with the user (e.g. iPhone, Android) and stores it to DynamoDB
 * @param endpointArn - The userId
 * @param topicArn - The Device details (e.g. endpointArn)
 * @notExported
 */
async function getSubscriptionArnFromEndpointAndTopic(endpointArn: string, topicArn: string): Promise<string> {
  const listSubscriptionsByTopicParams = {TopicArn: topicArn}
  logDebug('getSubscriptionArnFromEndpointAndTopic <=', listSubscriptionsByTopicParams)
  const listSubscriptionsByTopicResponse = await listSubscriptionsByTopic(listSubscriptionsByTopicParams)
  logDebug('getSubscriptionArnFromEndpointAndTopic =>', listSubscriptionsByTopicResponse)
  if (!listSubscriptionsByTopicResponse || !listSubscriptionsByTopicResponse.Subscriptions) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  const result = listSubscriptionsByTopicResponse.Subscriptions.filter((subscription) => {
    return subscription.Endpoint === endpointArn
  })
  if (!result || result.length === 0 || !result[0].SubscriptionArn) {
    throw new UnexpectedError('Invalid subscription response')
  }
  return result[0].SubscriptionArn
}

/**
 * Registers a Device (e.g. iPhone) to receive push notifications via AWS SNS
 * @notExported
 */
export async function handler(event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> {
  logInfo('event <=', event)
  let requestBody
  try {
    verifyPlatformConfiguration()
    requestBody = getPayloadFromEvent(event) as DeviceRegistrationRequest
    validateRequest(requestBody, registerDeviceSchema)
  } catch (error) {
    return lambdaErrorResponse(context, error)
  }
  try {
    const platformEndpoint = await createPlatformEndpointFromToken(requestBody.token)
    const pushNotificationTopicArn = process.env.PushNotificationTopicArn as string
    const device = {...requestBody, endpointArn: platformEndpoint.EndpointArn} as Device
    const {userId, userStatus} = getUserDetailsFromEvent(event)
    // Store the device details, regardless of user status
    await upsertDevice(process.env.DynamoDBTableDevices as string, device)
    /* istanbul ignore else */
    if (userStatus === UserStatus.Authenticated && userId) {
      // Extract the userId and associate them
      const table = process.env.DynamoDBTableUserDevices as string
      // Store the device details associated with the user
      await upsertUserDevices(table, userId, requestBody.deviceId)
      // Determine if the user already exists
      const userDevices = await getUserDevices(table, userId)
      if (userDevices.length === 1) {
        return response(context, 200, {endpointArn: device.endpointArn})
      } else {
        // Confirm the subscription, and unsubscribe
        const subscriptionArn = await getSubscriptionArnFromEndpointAndTopic(device.endpointArn, pushNotificationTopicArn)
        await unsubscribeEndpointToTopic(subscriptionArn)
        return response(context, 201, {
          endpointArn: platformEndpoint.EndpointArn
        })
      }
    } else if (userStatus === UserStatus.Anonymous) {
      // If the user hasn't registered; add them to the unregistered topic
      await subscribeEndpointToTopic(device.endpointArn, pushNotificationTopicArn)
    } else if (userStatus === UserStatus.Unauthenticated) {
      // If the user is unauthenticated, then need to authenticate
      throw new UnauthorizedError('Unauthenticated -- please login')
    }
    return response(context, 200, {endpointArn: device.endpointArn})
  } catch (error) {
    return lambdaErrorResponse(context, error)
  }
}
