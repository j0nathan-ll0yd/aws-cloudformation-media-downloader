/**
 * Device Helper Functions
 *
 * Shared utilities for device management across multiple Lambda functions.
 * Handles device registration, unregistration, and SNS subscriptions.
 */
import {deleteDevice as deleteDeviceQuery, deleteUserDevice as deleteUserDeviceQuery, getUserDevicesByUserId} from '#entities/queries'
import {logDebug} from '#lib/system/logging'
import type {UserDevice} from '#types/persistenceTypes'
import type {Device} from '#types/domainModels'
import {deleteEndpoint, subscribe, unsubscribe} from '#lib/vendor/AWS/SNS'

/**
 * Disassociates a deviceId from a User by deleting the UserDevice record
 * @param userId - The UUID of the User
 * @param deviceId - The UUID of the Device
 * @see {@link lambdas/PruneDevices/src!#handler | PruneDevices }
 */
export async function deleteUserDevice(userId: string, deviceId: string): Promise<void> {
  logDebug('deleteUserDevice <=', {userId, deviceId})
  await deleteUserDeviceQuery(userId, deviceId)
  logDebug('deleteUserDevice => done')
}

/**
 * Removes a Device from the database.
 * This includes deleting the associated endpoint from SNS.
 * @param device - The Device object from the database
 * @see {@link lambdas/PruneDevices/src!#handler | PruneDevices }
 * @see {@link lambdas/UserDelete/src!#handler | UserDelete }
 */
export async function deleteDevice(device: Device): Promise<void> {
  const removeEndpointParams = {EndpointArn: device.endpointArn}
  logDebug('deleteDevice.deleteEndpoint <=', removeEndpointParams)
  const removeEndpointResponse = await deleteEndpoint(removeEndpointParams)
  logDebug('deleteDevice.deleteEndpoint =>', removeEndpointResponse)
  logDebug('deleteDevice.deleteItem <=', device.deviceId)
  await deleteDeviceQuery(device.deviceId)
  logDebug('deleteDevice.deleteItem => done')
}

/**
 * Queries a user's device parameters from the database
 * Returns array of UserDevice records (one per device association)
 * @param userId - The userId
 * @see {@link lambdas/UserDelete/src!#handler | UserDelete }
 * @see {@link lambdas/RegisterDevice/src!#handler | RegisterDevice }
 */
export async function getUserDevices(userId: string): Promise<UserDevice[]> {
  logDebug('getUserDevices <=', userId)
  const response = await getUserDevicesByUserId(userId)
  logDebug('getUserDevices =>', response)
  return response as UserDevice[]
}

/**
 * Subscribes an endpoint (a client device) to an SNS topic
 * @param endpointArn - The EndpointArn of a mobile app and device
 * @param topicArn - The ARN of the topic you want to subscribe to
 * @see {@link lambdas/RegisterDevice/src!#handler | RegisterDevice }
 * @see {@link lambdas/UserSubscribe/src!#handler | UserSubscribe }
 */
export async function subscribeEndpointToTopic(endpointArn: string, topicArn: string) {
  const subscribeParams = {Endpoint: endpointArn, Protocol: 'application', TopicArn: topicArn}
  logDebug('subscribe <=', subscribeParams)
  const subscribeResponse = await subscribe(subscribeParams)
  logDebug('subscribe =>', subscribeResponse)
  return subscribeResponse
}

/**
 * Unsubscribes an endpoint (a client device) from an SNS topic
 * @param subscriptionArn - The SubscriptionArn of an endpoint+topic
 * @see {@link lambdas/RegisterDevice/src!#handler | RegisterDevice }
 */
export async function unsubscribeEndpointToTopic(subscriptionArn: string) {
  logDebug('unsubscribeEndpointToTopic <=', subscriptionArn)
  const response = await unsubscribe({SubscriptionArn: subscriptionArn})
  logDebug('unsubscribeEndpointToTopic =>', response)
  return response
}
