// These are methods that are shared across multiple lambdas
import {Devices} from '../entities/Devices'
import {UserDevices} from '../entities/UserDevices'
import {Files} from '../entities/Files'
import {Users} from '../entities/Users'
import type {EntityItem} from '../lib/vendor/ElectroDB/entity'
import {logDebug} from './lambda-helpers'
import {Device, DynamoDBFile, DynamoDBUserDevice, User} from '../types/main'
import {deleteEndpoint, subscribe} from '../lib/vendor/AWS/SNS'
import axios, {AxiosRequestConfig} from 'axios'
import {invokeAsync} from '../lib/vendor/AWS/Lambda'
import {scanAllPages} from './pagination'

/**
 * Disassociates a deviceId from a User by deleting the UserDevice record
 * @param userId - The UUID of the User
 * @param deviceId - The UUID of the Device
 * @see {@link lambdas/PruneDevices/src!#handler | PruneDevices }
 */
export async function deleteUserDevice(userId: string, deviceId: string): Promise<void> {
  logDebug('deleteUserDevice <=', {userId, deviceId})
  const response = await UserDevices.delete({userId, deviceId}).go()
  logDebug('deleteUserDevice =>', response)
}

/**
 * Removes a Device from DynamoDB.
 * This includes deleting the associated endpoint from SNS.
 * @param device - The Device object from DynamoDB
 * @see {@link lambdas/PruneDevices/src!#handler | PruneDevices }
 * @see {@link lambdas/UserDelete/src!#handler | UserDelete }
 */
export async function deleteDevice(device: Device): Promise<void> {
  const removeEndpointParams = {EndpointArn: device.endpointArn}
  logDebug('deleteDevice.deleteEndpoint <=', removeEndpointParams)
  const removeEndpointResponse = await deleteEndpoint(removeEndpointParams)
  logDebug('deleteDevice.deleteEndpoint =>', removeEndpointResponse)
  logDebug('deleteDevice.deleteItem <=', device.deviceId)
  const removedDeviceResponse = await Devices.delete({deviceId: device.deviceId}).go()
  logDebug('deleteDevice.deleteItem =>', removedDeviceResponse)
}

/**
 * Queries a user's device parameters from DynamoDB
 * Returns array of UserDevice records (one per device association)
 * @param userId - The userId
 * @see {@link lambdas/UserDelete/src!#handler | UserDelete }
 * @see {@link lambdas/RegisterDevice/src!#handler | RegisterDevice }
 */
export async function getUserDevices(userId: string): Promise<DynamoDBUserDevice[]> {
  logDebug('getUserDevices <=', userId)
  const response = await UserDevices.query.byUser({userId}).go()
  logDebug('getUserDevices =>', response)
  if (!response || !response.data) {
    return []
  }
  return response.data as DynamoDBUserDevice[]
}

/**
 * Subscribes an endpoint (a client device) to an SNS topic
 * @param endpointArn - The EndpointArn of a mobile app and device
 * @param topicArn - The ARN of the topic you want to subscribe to
 * @see {@link lambdas/RegisterDevice/src!#handler | RegisterDevice }
 * @see {@link lambdas/UserSubscribe/src!#handler | UserSubscribe }
 */
export async function subscribeEndpointToTopic(endpointArn: string, topicArn: string) {
  const subscribeParams = {
    Endpoint: endpointArn,
    Protocol: 'application',
    TopicArn: topicArn
  }
  logDebug('subscribe <=', subscribeParams)
  const subscribeResponse = await subscribe(subscribeParams)
  logDebug('subscribe =>', subscribeResponse)
  return subscribeResponse
}

/**
 * Upsert a File object in DynamoDB
 * @param item - The DynamoDB item to be added
 * @see {@link lambdas/StartFileUpload/src!#handler | StartFileUpload }
 */
export async function upsertFile(item: DynamoDBFile) {
  logDebug('upsertFile <=', item)
  const updateResponse = await Files.upsert(item).go()
  logDebug('upsertFile =>', updateResponse)
  return updateResponse
}

/**
 * Searches for a User record via their Apple Device ID using paginated scan
 * @param userDeviceId - The subject registered claim that identifies the principal user.
 * @see {@link lambdas/RegisterUser/src!#handler | RegisterUser }
 * @see {@link lambdas/LoginUser/src!#handler | LoginUser }
 */
export async function getUsersByAppleDeviceIdentifier(userDeviceId: string): Promise<User[]> {
  logDebug('getUsersByAppleDeviceIdentifier <=', userDeviceId)

  type UserEntity = EntityItem<typeof Users>
  const allUsers = await scanAllPages<UserEntity>(async (cursor) => {
    const scanResponse = await Users.scan.go({cursor})
    return {
      data: scanResponse.data || [],
      cursor: scanResponse.cursor ?? null
    }
  })

  logDebug('getUsersByAppleDeviceIdentifier: scanned users', {count: allUsers.length})

  // Filter in memory since we can't query on nested identity provider field
  const usersWithAppleId = allUsers.filter((user) => user.identityProviders?.userId === userDeviceId)
  logDebug('getUsersByAppleDeviceIdentifier =>', {matchCount: usersWithAppleId.length})
  return usersWithAppleId as User[]
}

/**
 * Initiates a file download by invoking the StartFileUpload Lambda
 * Uses asynchronous invocation (Event type) to avoid blocking
 * @param fileId - The YouTube video ID to download
 * @see {@link lambdas/FileCoordinator/src!#handler | FileCoordinator }
 * @see {@link lambdas/WebhookFeedly/src!#handler | WebhookFeedly }
 */
export async function initiateFileDownload(fileId: string) {
  logDebug('initiateFileDownload <=', fileId)

  const result = await invokeAsync('StartFileUpload', {fileId})

  logDebug('initiateFileDownload =>', {
    StatusCode: result.StatusCode,
    fileId
  })
}

/**
 * Makes an HTTP request via Axios
 * @param options - The [request configuration](https://github.com/axios/axios#request-config)
 */
export async function makeHttpRequest(options: AxiosRequestConfig) {
  logDebug('axios <= ', options)
  logDebug(JSON.stringify(axios))
  logDebug('axios')
  const axiosResponse = await axios(options)
  logDebug('axios.status =>', `${axiosResponse.status} ${axiosResponse.statusText}`)
  logDebug('axios.headers =>', axiosResponse.headers)
  return axiosResponse
}
