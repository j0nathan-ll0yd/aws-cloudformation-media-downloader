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

/**
 * Disassociates a deviceId from a User by deleting the UserDevice record
 * @param userId - The UUID of the User
 * @param deviceId - The UUID of the Device
 * @see PruneDevices Lambda handler
 */
export async function deleteUserDevice(userId: string, deviceId: string): Promise<void> \{
  logDebug('deleteUserDevice <=', \{userId, deviceId\})
  const response = await UserDevices.delete({userId, deviceId}).go()
  logDebug('deleteUserDevice =>', response)
}

/**
 * Removes a Device from DynamoDB.
 * This includes deleting the associated endpoint from SNS.
 * @param device - The Device object from DynamoDB
 * @see PruneDevices Lambda handler
 * @see UserDelete Lambda handler
 */
export async function deleteDevice(device: Device): Promise<void> \{
  const removeEndpointParams = \{EndpointArn: device.endpointArn\}
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
 * @see UserDelete Lambda handler
 * @see RegisterDevice Lambda handler
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
 * @see RegisterDevice Lambda handler
 * @see UserSubscribe Lambda handler
 */
export async function subscribeEndpointToTopic(endpointArn: string, topicArn: string) \{
  const subscribeParams = \{
    Endpoint: endpointArn,
    Protocol: 'application',
    TopicArn: topicArn
  \}
  logDebug('subscribe <=', subscribeParams)
  const subscribeResponse = await subscribe(subscribeParams)
  logDebug('subscribe =>', subscribeResponse)
  return subscribeResponse
}

/**
 * Upsert a File object in DynamoDB
 * @param item - The DynamoDB item to be added
 * @see StartFileUpload Lambda handler
 */
export async function upsertFile(item: DynamoDBFile) {
  logDebug('upsertFile <=', item)
  const updateResponse = await Files.upsert(item).go()
  logDebug('upsertFile =>', updateResponse)
  return updateResponse
}

/**
 * Searches for a User record via their Apple Device ID
 * @param userDeviceId - The subject registered claim that identifies the principal user.
 * @see RegisterUser Lambda handler
 * @see LoginUser Lambda handler
 */
export async function getUsersByAppleDeviceIdentifier(userDeviceId: string): Promise<User[]> {
  logDebug('getUsersByAppleDeviceIdentifier <=', userDeviceId)
  const scanResponse = await Users.scan.go()
  logDebug('getUsersByAppleDeviceIdentifier =>', scanResponse)
  if (!scanResponse || !scanResponse.data) {
    return []
  }

  // Filter in memory since we can't query on nested identity provider field
  type UserEntity = EntityItem<typeof Users>
  const usersWithAppleId = scanResponse.data.filter((user: UserEntity) => user.identityProviders?.userId === userDeviceId)
  return usersWithAppleId as User[]
}

/**
 * Initiates a file download by invoking the StartFileUpload Lambda
 * Uses asynchronous invocation (Event type) to avoid blocking
 * @param fileId - The YouTube video ID to download
 * @see FileCoordinator Lambda handler
 * @see WebhookFeedly Lambda handler
 */
export async function initiateFileDownload(fileId: string) {
  logDebug('initiateFileDownload <=', fileId)

  const result = await invokeAsync('StartFileUpload', {fileId})

  logDebug('initiateFileDownload =>', \{
    StatusCode: result.StatusCode,
    fileId
  \})
}

/**
 * Makes an HTTP request via Axios
 * @param options - The request configuration from axios
 * @see UploadPart Lambda handler
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
