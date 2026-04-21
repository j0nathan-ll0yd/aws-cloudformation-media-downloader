/**
 * Device Registration Service
 *
 * Handles platform endpoint creation, device storage, and subscription management
 * for the device registration flow.
 */
import {createPlatformEndpoint, listSubscriptionsByTopic} from '@mantleframework/aws'
import {getRequiredEnv} from '@mantleframework/env'
import {ServiceUnavailableError, UnexpectedError} from '@mantleframework/errors'
import {logDebug} from '@mantleframework/observability'
import {upsertDevice as upsertDeviceRecord, upsertUserDevice} from '#entities/queries'
import {providerFailureErrorMessage} from '#errors/custom-errors'
import type {Device} from '#types/domainModels'

/** Creates platform endpoint from device token */
export async function createPlatformEndpointFromToken(token: string) {
  const platformApplicationArn = getRequiredEnv('PLATFORM_APPLICATION_ARN')
  logDebug('createPlatformEndpoint', {platformApplicationArn, token})
  const response = await createPlatformEndpoint(platformApplicationArn, token)
  if (!response) {
    throw new ServiceUnavailableError('AWS failed to respond')
  }
  logDebug('createPlatformEndpoint response', {endpointArn: response.EndpointArn})
  return response
}

/** Store user-device relationship */
export async function upsertUserDevices(userId: string, deviceId: string) {
  logDebug('upsertUserDevices', {userId, deviceId})
  const response = await upsertUserDevice({userId, deviceId})
  logDebug('upsertUserDevices completed')
  return response
}

/** Store device details */
export async function upsertDevice(device: Device) {
  logDebug('upsertDevice', {deviceId: device.deviceId})
  const response = await upsertDeviceRecord({
    deviceId: device.deviceId,
    endpointArn: device.endpointArn,
    token: device.token,
    name: device.name,
    systemVersion: device.systemVersion,
    systemName: device.systemName
  })
  logDebug('upsertDevice completed')
  return response
}

/** Gets subscription ARN for an endpoint */
export async function getSubscriptionArnFromEndpointAndTopic(endpointArn: string, topicArn: string): Promise<string> {
  logDebug('getSubscriptionArnFromEndpointAndTopic', {endpointArn, topicArn})
  const listResponse = await listSubscriptionsByTopic(topicArn)
  logDebug('getSubscriptionArnFromEndpointAndTopic response', {subscriptionCount: listResponse?.Subscriptions?.length ?? 0})
  if (!listResponse?.Subscriptions) {
    throw new ServiceUnavailableError(providerFailureErrorMessage)
  }
  const result = listResponse.Subscriptions.filter((subscription) => {
    return subscription.Endpoint === endpointArn
  })
  if (!result || result.length === 0 || !result[0]?.SubscriptionArn) {
    throw new UnexpectedError('Invalid subscription response')
  }
  return result[0].SubscriptionArn
}
