/**
 * RegisterDevice Lambda
 *
 * Registers iOS devices for push notifications via APNS.
 * Creates platform endpoint and subscribes to notification topics.
 *
 * Trigger: API Gateway POST /devices
 * Input: DeviceRegistrationRequest with device token
 * Output: APIGatewayProxyResult with device registration
 */
import {upsertDevice as upsertDeviceRecord, upsertUserDevice} from '#entities/queries'
import {createPlatformEndpoint, listSubscriptionsByTopic} from '#lib/vendor/AWS/SNS'
import {UserStatus} from '#types/enums'
import {deviceRegistrationRequestSchema, deviceRegistrationResponseSchema} from '#types/api-schema'
import type {DeviceRegistrationRequest} from '#types/api-schema'
import type {Device} from '#types/domainModels'
import {getPayloadFromEvent, validateRequest} from '#lib/lambda/middleware/apiGateway'
import {getUserDevices, subscribeEndpointToTopic, unsubscribeEndpointToTopic} from '#lib/domain/device/deviceService'
import {getRequiredEnv} from '#lib/system/env'
import {providerFailureErrorMessage, ServiceUnavailableError, UnexpectedError} from '#lib/system/errors'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {verifyPlatformConfiguration} from '#lib/lambda/context'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapOptionalAuthHandler} from '#lib/lambda/middleware/api'
import {logDebug} from '#lib/system/logging'

/**
 * An idempotent operation that creates an endpoint for a device on one of the supported services (e.g. GCP, APNS).
 *
 * @param token - The client device token
 * @returns The created platform endpoint response
 * @notExported
 */
async function createPlatformEndpointFromToken(token: string) {
  // An idempotent option that creates an endpoint for a device on one of the supported services (e.g. GCP, APNS)
  const params = {PlatformApplicationArn: getRequiredEnv('PLATFORM_APPLICATION_ARN'), Token: token}
  logDebug('createPlatformEndpoint <=', params)
  const createPlatformEndpointResponse = await createPlatformEndpoint(params)
  if (!createPlatformEndpointResponse) {
    throw new ServiceUnavailableError('AWS failed to respond')
  }
  logDebug('createPlatformEndpoint =>', createPlatformEndpointResponse)
  return createPlatformEndpointResponse
}

/**
 * Store the device details associated with the user by creating a UserDevice record.
 * Creates individual record for the user-device relationship.
 *
 * @param userId - The userId
 * @param deviceId - The UUID of the device (either iOS or Android)
 * @returns The upsert response from ElectroDB
 * @notExported
 */
async function upsertUserDevices(userId: string, deviceId: string) {
  logDebug('upsertUserDevices <=', {userId, deviceId})
  const response = await upsertUserDevice({userId, deviceId})
  logDebug('upsertUserDevices =>', response)
  return response
}

/**
 * Store the device details independent of the user (e.g. iPhone, Android) and stores it to DynamoDB.
 *
 * @param device - The Device details (e.g. endpointArn)
 * @returns The upsert response from ElectroDB
 * @notExported
 */
async function upsertDevice(device: Device) {
  logDebug('upsertDevice <=', device)
  const response = await upsertDeviceRecord({
    deviceId: device.deviceId,
    endpointArn: device.endpointArn,
    token: device.token,
    name: device.name,
    systemVersion: device.systemVersion,
    systemName: device.systemName
  })
  logDebug('upsertDevice =>', response)
  return response
}

/**
 * Gets the subscription ARN for an endpoint subscribed to a topic.
 *
 * @param endpointArn - The SNS platform endpoint ARN
 * @param topicArn - The SNS topic ARN
 * @returns The subscription ARN if found
 * @notExported
 */
async function getSubscriptionArnFromEndpointAndTopic(endpointArn: string, topicArn: string): Promise<string> {
  const listSubscriptionsByTopicParams = {TopicArn: topicArn}
  logDebug('getSubscriptionArnFromEndpointAndTopic <=', listSubscriptionsByTopicParams)
  const listSubscriptionsByTopicResponse = await listSubscriptionsByTopic(listSubscriptionsByTopicParams)
  logDebug('getSubscriptionArnFromEndpointAndTopic =>', listSubscriptionsByTopicResponse)
  if (!listSubscriptionsByTopicResponse || !listSubscriptionsByTopicResponse.Subscriptions) {
    throw new ServiceUnavailableError(providerFailureErrorMessage)
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
 * Unauthenticated users (invalid token) are rejected with 401 by wrapOptionalAuthHandler
 * @notExported
 */
export const handler = withPowertools(wrapOptionalAuthHandler(async ({event, context, userId, userStatus, metadata}) => {
  const {correlationId} = metadata
  logDebug('RegisterDevice <=', {correlationId, userStatus})
  // wrapOptionalAuthHandler already rejected Unauthenticated users with 401
  verifyPlatformConfiguration()
  const requestBody = getPayloadFromEvent(event) as DeviceRegistrationRequest
  validateRequest(requestBody, deviceRegistrationRequestSchema)

  const platformEndpoint = await createPlatformEndpointFromToken(requestBody.token)
  const pushNotificationTopicArn = getRequiredEnv('PUSH_NOTIFICATION_TOPIC_ARN')
  const device = {...requestBody, endpointArn: platformEndpoint.EndpointArn} as Device
  // Store the device details, regardless of user status
  await upsertDevice(device)
  /* c8 ignore else */
  if (userStatus === UserStatus.Authenticated && userId) {
    // Extract the userId and associate them
    // Store the device details associated with the user
    await upsertUserDevices(userId, requestBody.deviceId)
    // Determine if the user already exists
    const userDevices = await getUserDevices(userId)
    if (userDevices.length === 1) {
      return buildValidatedResponse(context, 200, {endpointArn: device.endpointArn}, deviceRegistrationResponseSchema)
    } else {
      // Confirm the subscription, and unsubscribe
      const subscriptionArn = await getSubscriptionArnFromEndpointAndTopic(device.endpointArn, pushNotificationTopicArn)
      await unsubscribeEndpointToTopic(subscriptionArn)
      return buildValidatedResponse(context, 201, {endpointArn: platformEndpoint.EndpointArn}, deviceRegistrationResponseSchema)
    }
  } else if (userStatus === UserStatus.Anonymous) {
    // If the user hasn't registered; add them to the unregistered topic
    await subscribeEndpointToTopic(device.endpointArn, pushNotificationTopicArn)
  }
  return buildValidatedResponse(context, 200, {endpointArn: device.endpointArn}, deviceRegistrationResponseSchema)
}))
