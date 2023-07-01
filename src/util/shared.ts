// These are methods that are shared across multiple lambdas
import {deleteDeviceParams, deleteSingleUserDeviceParams, getUserByAppleDeviceIdentifierParams, queryUserDeviceParams, updateFileMetadataParams} from './dynamodb-helpers'
import {logDebug} from './lambda-helpers'
import {deleteItem, query, scan, updateItem} from '../lib/vendor/AWS/DynamoDB'
import {Device, DynamoDBFile, DynamoDBUserDevice, Metadata, User} from '../types/main'
import {deleteEndpoint, subscribe} from '../lib/vendor/AWS/SNS'
import {providerFailureErrorMessage, UnexpectedError} from './errors'
import {Types} from 'aws-sdk/clients/stepfunctions'
import {startExecution} from '../lib/vendor/AWS/StepFunctions'
import {transformVideoIntoDynamoItem} from './transformers'
import axios, {AxiosRequestConfig} from 'axios'
import {FileStatus} from '../types/enums'

/**
 * Disassociates a deviceId from a User
 * @param userId - The UUID of the User
 * @param deviceId - The UUID of the Device
 * @see {@link lambdas/PruneDevices/src!#handler | PruneDevices }
 */
export async function deleteUserDevice(userId: string, deviceId: string): Promise<void> {
  const params = deleteSingleUserDeviceParams(process.env.DynamoDBTableUserDevices as string, userId, deviceId)
  logDebug('deleteUserDevice <=', params)
  const response = await updateItem(params)
  logDebug('deleteUserDevice <=', response)
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
  const removeDeviceParams = deleteDeviceParams(process.env.DynamoDBTableDevices as string, device.deviceId)
  logDebug('deleteDevice.deleteItem <=', removeDeviceParams)
  const removedDeviceResponse = await deleteItem(removeDeviceParams)
  logDebug('deleteDevice.deleteItem =>', removedDeviceResponse)
}

/**
 * Queries a user's device parameters from DynamoDB
 * @param table - The DynamoDB table to perform the operation on
 * @param userId - The userId
 * @see {@link lambdas/UserDelete/src!#handler | UserDelete }
 * @see {@link lambdas/RegisterDevice/src!#handler | RegisterDevice }
 */
export async function getUserDevices(table: string, userId: string): Promise<DynamoDBUserDevice[]> {
  const params = queryUserDeviceParams(table, userId)
  logDebug('getUserDevices <=', params)
  const response = await query(params)
  logDebug('getUserDevices =>', response)
  if (!response || !response.Items) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return response.Items as DynamoDBUserDevice[]
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
  const updateItemParams = updateFileMetadataParams(process.env.DynamoDBTableFiles as string, item)
  logDebug('updateItem <=', updateItemParams)
  const updateResponse = await updateItem(updateItemParams)
  logDebug('updateItem =>', updateResponse)
  return updateResponse
}

/**
 * Searches for a User record via their Apple Device ID
 * @param userDeviceId - The subject registered claim that identifies the principal user.
 * @see {@link lambdas/RegisterUser/src!#handler | RegisterUser }
 * @see {@link lambdas/LoginUser/src!#handler | LoginUser }
 */
export async function getUsersByAppleDeviceIdentifier(userDeviceId: string): Promise<User[]> {
  const scanParams = getUserByAppleDeviceIdentifierParams(process.env.DynamoDBTableUsers as string, userDeviceId)
  logDebug('getUsersByAppleDeviceIdentifier <=', scanParams)
  const scanResponse = await scan(scanParams)
  logDebug('getUsersByAppleDeviceIdentifier =>', scanResponse)
  if (!scanResponse || !scanResponse.Items) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return scanResponse.Items as User[]
}

/**
 * Triggers the process for downloading a file and storing it in S3
 * @param fileId - The YouTube fileId to be downloaded
 * @see {@link lambdas/FileCoordinator/src!#handler | FileCoordinator }
 * @see {@link lambdas/WebhookFeedly/src!#handler | WebhookFeedly }
 */
export async function initiateFileDownload(fileId: string) {
  const params = {
    input: JSON.stringify({fileId}),
    name: new Date().getTime().toString(),
    stateMachineArn: process.env.StateMachineArn
  } as Types.StartExecutionInput
  logDebug('startExecution <=', params)
  const output = await startExecution(params)
  logDebug('startExecution =>', output)
}

/**
 * Create a DynamoDBFile object from a video's metadata
 * @param metadata - The Metadata for a video; generated through youtube-dl
 * @returns DynamoDBFile
 * @see {@link lambdas/StartFileUpload/src!#handler | StartFileUpload }
 */
export async function getFileFromMetadata(metadata: Metadata): Promise<DynamoDBFile> {
  const myDynamoItem = transformVideoIntoDynamoItem(metadata)
  const videoUrl = metadata.formats[0].url
  const options: AxiosRequestConfig = {
    method: 'head',
    timeout: 900000,
    url: videoUrl
  }

  const fileInfo = await makeHttpRequest(options)
  // TODO: Ensure these headers exist in the response
  const bytesTotal = parseInt(fileInfo.headers['content-length'], 10)
  const contentType = fileInfo.headers['content-type']

  myDynamoItem.size = bytesTotal
  myDynamoItem.publishDate = new Date(metadata.published).toISOString()
  myDynamoItem.contentType = contentType
  myDynamoItem.status = FileStatus.PendingDownload
  return myDynamoItem
}

/**
 * Makes an HTTP request via Axios
 * @param options - The [request configuration](https://github.com/axios/axios#request-config)
 * @see {@link lambdas/UploadPart/src!#handler | UploadPart }
 */
export async function makeHttpRequest(options: AxiosRequestConfig) {
  //logDebug('axios <= ', options)
  logDebug('axios')
  const axiosResponse = await axios(options)
  logDebug('axios.status =>', `${axiosResponse.status} ${axiosResponse.statusText}`)
  logDebug('axios.headers =>', axiosResponse.headers)
  return axiosResponse
}
