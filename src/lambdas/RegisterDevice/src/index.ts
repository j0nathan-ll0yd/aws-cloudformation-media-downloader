import {Devices} from '#entities/Devices'
import {UserDevices} from '#entities/UserDevices'
import {createPlatformEndpoint, listSubscriptionsByTopic} from '#lib/vendor/AWS/SNS'
import type {Device} from '#types/domain-models'
import {UserStatus} from '#types/enums'
import {getPayloadFromEvent, validateRequest} from '#util/apigateway-helpers'
import {registerDeviceSchema} from '#util/constraints'
import {getUserDevices, subscribeEndpointToTopic, unsubscribeEndpointToTopic} from '#util/device-helpers'
import {getRequiredEnv} from '#util/env-validation'
import {providerFailureErrorMessage, UnexpectedError} from '#util/errors'
import {buildApiResponse, verifyPlatformConfiguration, withPowertools, wrapOptionalAuthHandler} from '#util/lambda-helpers'
import {logDebug} from '#util/logging'

interface DeviceRegistrationRequest {
  name: string
  token: string
  systemVersion: string
  deviceId: string
  systemName: string
}

/**
 * An idempotent operation that creates an endpoint for a device on one of the supported services (e.g. GCP, APNS)
 * @param token - The client device token
 * @notExported
 */
async function createPlatformEndpointFromToken(token: string) {
  // An idempotent option that creates an endpoint for a device on one of the supported services (e.g. GCP, APNS)
  const params = {PlatformApplicationArn: getRequiredEnv('PlatformApplicationArn'), Token: token}
  logDebug('createPlatformEndpoint <=', params)
  const createPlatformEndpointResponse = await createPlatformEndpoint(params)
  if (!createPlatformEndpointResponse) {
    throw new UnexpectedError('AWS failed to respond')
  }
  logDebug('createPlatformEndpoint =>', createPlatformEndpointResponse)
  return createPlatformEndpointResponse
}

/**
 * Store the device details associated with the user by creating a UserDevice record
 * Creates individual record for the user-device relationship
 * @param userId - The userId
 * @param deviceId - The UUID of the device (either iOS or Android)
 * @notExported
 */
async function upsertUserDevices(userId: string, deviceId: string) {
  logDebug('upsertUserDevices <=', {userId, deviceId})
  const response = await UserDevices.upsert({userId, deviceId}).go()
  logDebug('upsertUserDevices =>', response)
  return response
}

/**
 * Store the device details independent of the user (e.g. iPhone, Android) and stores it to DynamoDB
 * @param device - The Device details (e.g. endpointArn)
 * @notExported
 */
async function upsertDevice(device: Device) {
  logDebug('upsertDevice <=', device)
  const response = await Devices.upsert({
    deviceId: device.deviceId,
    endpointArn: device.endpointArn,
    token: device.token,
    name: device.name,
    systemVersion: device.systemVersion,
    systemName: device.systemName
  }).go()
  logDebug('upsertDevice =>', response)
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
 * Unauthenticated users (invalid token) are rejected with 401 by wrapOptionalAuthHandler
 * @notExported
 */
export const handler = withPowertools(wrapOptionalAuthHandler(async ({event, context, userId, userStatus}) => {
  // wrapOptionalAuthHandler already rejected Unauthenticated users with 401
  verifyPlatformConfiguration()
  const requestBody = getPayloadFromEvent(event) as DeviceRegistrationRequest
  validateRequest(requestBody, registerDeviceSchema)

  const platformEndpoint = await createPlatformEndpointFromToken(requestBody.token)
  const pushNotificationTopicArn = getRequiredEnv('PushNotificationTopicArn')
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
      return buildApiResponse(context, 200, {endpointArn: device.endpointArn})
    } else {
      // Confirm the subscription, and unsubscribe
      const subscriptionArn = await getSubscriptionArnFromEndpointAndTopic(device.endpointArn, pushNotificationTopicArn)
      await unsubscribeEndpointToTopic(subscriptionArn)
      return buildApiResponse(context, 201, {endpointArn: platformEndpoint.EndpointArn})
    }
  } else if (userStatus === UserStatus.Anonymous) {
    // If the user hasn't registered; add them to the unregistered topic
    await subscribeEndpointToTopic(device.endpointArn, pushNotificationTopicArn)
  }
  return buildApiResponse(context, 200, {endpointArn: device.endpointArn})
}))
