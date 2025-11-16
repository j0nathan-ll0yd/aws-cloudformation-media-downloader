// These are methods that are shared across multiple lambdas
import {deleteDeviceParams, deleteSingleUserDeviceParams, getUserByAppleDeviceIdentifierParams, queryUserDeviceParams, updateFileMetadataParams} from './dynamodb-helpers'
import {logDebug} from './lambda-helpers'
import {deleteItem, query, scan, updateItem} from '../lib/vendor/AWS/DynamoDB'
import {Device, DynamoDBFile, DynamoDBUserDevice, User} from '../types/main'
import {deleteEndpoint, subscribe} from '../lib/vendor/AWS/SNS'
import {providerFailureErrorMessage, UnexpectedError} from './errors'
// DEPRECATED: Commented out after yt-dlp migration - Step Functions no longer used
// import {startExecution} from '../lib/vendor/AWS/StepFunctions'
// import {StartExecutionInput} from '@aws-sdk/client-sfn'
// DEPRECATED: Commented out after yt-dlp migration
// import {transformVideoIntoDynamoItem} from './transformers'
import axios, {AxiosRequestConfig} from 'axios'
import {LambdaClient, InvokeCommand} from '@aws-sdk/client-lambda'

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
 * Initiates a file download by invoking the StartFileUpload Lambda
 * Uses asynchronous invocation (Event type) to avoid blocking
 * @param fileId - The YouTube video ID to download
 * @see {@link lambdas/FileCoordinator/src!#handler | FileCoordinator }
 * @see {@link lambdas/WebhookFeedly/src!#handler | WebhookFeedly }
 */
export async function initiateFileDownload(fileId: string) {
  const lambdaClient = new LambdaClient({region: process.env.AWS_REGION || 'us-west-2'})

  const payload = JSON.stringify({fileId})
  const command = new InvokeCommand({
    FunctionName: 'StartFileUpload',
    InvocationType: 'Event', // Asynchronous invocation
    Payload: Buffer.from(payload)
  })

  logDebug('Lambda invoke (async) <=', {
    FunctionName: 'StartFileUpload',
    InvocationType: 'Event',
    fileId
  })

  const output = await lambdaClient.send(command)

  logDebug('Lambda invoke (async) =>', {
    StatusCode: output.StatusCode,
    fileId
  })
}

/**
 * DEPRECATED after yt-dlp migration
 * This function is no longer used. Functionality moved to StartFileUpload Lambda.
 * Create a DynamoDBFile object from a video's metadata
 * @param metadata - The Metadata for a video; generated through youtube-dl
 * @returns DynamoDBFile
 * @see {@link lambdas/StartFileUpload/src!#handler | StartFileUpload }
 */
// export async function getFileFromMetadata(metadata: Metadata): Promise<DynamoDBFile> {
//   logInfo('getFileFromMetadata <=', metadata)
//   const myDynamoItem = transformVideoIntoDynamoItem(metadata)
//   const videoUrl = metadata.formats[0].url
//   const options: AxiosRequestConfig = {
//     method: 'head',
//     timeout: 900000,
//     url: videoUrl
//   }
//
//   const fileInfo = await makeHttpRequest(options)
//   // TODO: Ensure these headers exist in the response
//   const bytesTotal = parseInt(fileInfo.headers['content-length'], 10)
//   const contentType = fileInfo.headers['content-type']
//
//   myDynamoItem.size = bytesTotal
//   myDynamoItem.publishDate = new Date(metadata.published).toISOString()
//   myDynamoItem.contentType = contentType
//   myDynamoItem.status = FileStatus.PendingDownload
//   return myDynamoItem
// }

/**
 * Makes an HTTP request via Axios
 * @param options - The [request configuration](https://github.com/axios/axios#request-config)
 * @see {@link lambdas/UploadPart/src!#handler | UploadPart }
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
