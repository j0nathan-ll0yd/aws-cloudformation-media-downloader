import {APIGatewayEvent, Context, CustomAuthorizerEvent, CustomAuthorizerResult, S3Event} from 'aws-lambda'
import {PublishInput} from 'aws-sdk/clients/sns'
import axios, {AxiosRequestConfig} from 'axios'
import * as querystring from 'querystring'
import {validate} from 'validate.js'
import {videoInfo} from 'ytdl-core'
import {CompleteMultipartUploadRequest, UploadPartRequest} from '../node_modules/aws-sdk/clients/s3'
import {getApiKeys, getUsage, getUsagePlans} from './lib/vendor/AWS/ApiGateway'
import {putItem, scan, updateItem} from './lib/vendor/AWS/DynamoDB'
import {completeMultipartUpload, createMultipartUpload, listObjects, uploadPart} from './lib/vendor/AWS/S3'
import {createPlatformEndpoint, publishSnsEvent, subscribe} from './lib/vendor/AWS/SNS'
import {startExecution} from './lib/vendor/AWS/StepFunctions'
import {fetchVideoInfo, getVideoID} from './lib/vendor/YouTube'
import {
  CompleteFileUploadEvent,
  DeviceRegistration,
  ExtendedS3Object,
  Metadata,
  UploadPartEvent, UserRegistration
} from './types/main'
import {ScheduledEvent} from './types/vendor/Amazon/CloudWatch/ScheduledEvent'
import {Webhook} from './types/vendor/IFTTT/Feedly/Webhook'
import {generateAllow, generateDeny} from './util/apigateway-helpers'
import {feedlyEventConstraints, registerDeviceConstraints, registerUserConstraints} from './util/constraints'
import {newFileParams, newUserParams, scanForFileParams, updateCompletedFileParams} from './util/dynamodb-helpers'
import {logDebug, logError, logInfo, response} from './util/lambda-helpers'
import {createAccessToken, getAppleClientSecret, getAppleConfig, validateAuthCodeForToken, verifyAppleToken} from './util/secretsmanager-helpers'
import {objectKeysToLowerCase, transformVideoInfoToMetadata, transformVideoIntoS3File} from './util/transformers'
import { v4 as uuidv4 } from 'uuid'

function processEventAndValidate(event: APIGatewayEvent | ScheduledEvent, constraints?) {
  let requestBody: Webhook | DeviceRegistration | UserRegistration
  if ('source' in event && event.source === 'aws.events') {
    return {statusCode: 200, message: {status: 'OK'}}
  } else if ('body' in event) {
    try {
      requestBody = JSON.parse(event.body)
      logDebug('processEventAndValidate.event.body <=', requestBody)
    } catch (error) {
      logError('processEventAndValidate =>', `Invalid JSON: ${error}`)
      return {statusCode: 400, message: 'Request body must be valid JSON'}
    }
  }
  if (constraints) {
    const invalidAttributes = validate(requestBody, constraints)
    if (invalidAttributes) {
      logError('processEventAndValidate =>', invalidAttributes)
      return {statusCode: 400, message: invalidAttributes}
    }
  }
  return {requestBody}
}

export async function handleAuthorization(event: CustomAuthorizerEvent): Promise<CustomAuthorizerResult> {
  logInfo('event <=', event)
  const responseDeny = generateDeny('me', event.methodArn)
  try {
    const queryStringParameters = event.queryStringParameters
    const apiKeyValue = queryStringParameters.ApiKey
    const getApiKeysParams = {includeValues: true}
    logDebug('getApiKeys <=', getApiKeysParams)
    const apiKeyResponse = await getApiKeys(getApiKeysParams)
    logDebug('getApiKeys =>', apiKeyResponse)
    const matchedApiKeys = apiKeyResponse.items.filter((item) => item.value === apiKeyValue)
    if (matchedApiKeys.length > 0) {
      const apiKey = matchedApiKeys[0]
      if (apiKey.enabled === false) {
        return generateDeny('me', event.methodArn)
      }
      const getUsagePlansParams = {keyId: apiKey.id}
      logDebug('getUsagePlans <=', getUsagePlansParams)
      const usagePlansResponse = await getUsagePlans(getUsagePlansParams)
      logDebug('getUsagePlans =>', usagePlansResponse)
      let responseAllow = generateAllow('me', event.methodArn)
      if (usagePlansResponse.items) {
        const usagePlanId = usagePlansResponse.items[0].id
        responseAllow = generateAllow('me', event.methodArn, apiKeyValue)
        const usageDate = (new Date()).toISOString().split('T')[0]
        const params = {
          endDate: usageDate,
          keyId: apiKey.id,
          startDate: usageDate,
          usagePlanId
        }
        logDebug('getUsage <=', params)
        const usageResponse = await getUsage(params)
        logDebug('getUsage =>', usageResponse)
      }
      logInfo('response =>', responseAllow)
      return responseAllow
    }
    logInfo('response =>', responseDeny)
    return responseDeny
  } catch (error) {
    logError('response =>', responseDeny)
    return responseDeny
  }
}

export async function handleFeedlyEvent(event: APIGatewayEvent | ScheduledEvent, context: Context) {
  logInfo('event <=', event)
  const {requestBody, statusCode, message} = processEventAndValidate(event, feedlyEventConstraints)
  if (statusCode && message) {
    return response(context, statusCode, message)
  }
  try {
    const body = (requestBody as Webhook)
    const fileId = await getVideoID(body.articleURL)
    const updateItemParams = newFileParams(process.env.DynamoDBTable, fileId)
    logDebug('updateItem <=', updateItemParams)
    const updateItemResponse = await updateItem(updateItemParams)
    logDebug('updateItem =>', updateItemResponse)
    if (updateItemResponse.Attributes && updateItemResponse.Attributes.hasOwnProperty('fileName')) {
      return response(context, 204)
    } else {
      return response(context, 202, {status: 'Accepted'})
    }
  } catch (error) {
    return response(context, 500, error.message)
  }
}

export async function handleDeviceRegistration(event: APIGatewayEvent, context: Context) {
  logInfo('event <=', event)
  const {requestBody, statusCode, message} = processEventAndValidate(event, registerDeviceConstraints)
  if (statusCode && message) {
    return response(context, statusCode, message)
  }
  const body = (requestBody as DeviceRegistration)
  // TODO: Add the device ID attribute, and figure out how to stop multiple subscriptions
  // const deviceId = event.headers['x-device-uuid']
  const createPlatformEndpointParams = {
    Attributes: {UserId: '1234', ChannelId: '1234'},
    PlatformApplicationArn: process.env.PlatformApplicationArn,
    Token: body.token
  }
  logDebug('createPlatformEndpoint <=', createPlatformEndpointParams)
  const createPlatformEndpointResponse = await createPlatformEndpoint(createPlatformEndpointParams)
  logDebug('createPlatformEndpoint =>', createPlatformEndpointParams)

  const subscribeParams = {
    Endpoint: createPlatformEndpointResponse.EndpointArn,
    Protocol: 'application',
    TopicArn: process.env.PushNotificationTopicArn
  }
  logDebug('subscribe <=', subscribeParams)
  const subscribeResponse = await subscribe(subscribeParams)
  logDebug('subscribe =>', subscribeResponse)

  return response(context, 201, {endpointArn: createPlatformEndpointResponse.EndpointArn})
}

export async function listFiles(event: APIGatewayEvent | ScheduledEvent, context: Context) {
  logInfo('event <=', event)
  const {statusCode, message} = processEventAndValidate(event)
  if (statusCode && message) {
    return response(context, statusCode, message)
  }
  try {
    const params = {Bucket: process.env.Bucket, MaxKeys: 1000}
    logDebug('listObjects <=', params)
    const files = await listObjects({Bucket: process.env.Bucket, MaxKeys: 1000})
    logDebug('listObjects =>', files)
    files.Contents.forEach((file: ExtendedS3Object) => {
      // https://lifegames-app-s3bucket-pq2lluyi2i12.s3.amazonaws.com/20191209-[sxephil].mp4
      file.FileUrl = `https://${files.Name}.s3.amazonaws.com/${encodeURIComponent(file.Key)}`
      return file
    })
    return response(context, 200, objectKeysToLowerCase(files))
  } catch (error) {
    throw new Error(error)
  }
}

export async function startFileUpload(event): Promise<UploadPartEvent> {
  logInfo('event <=', event)
  const fileId = event.fileId
  const fileUrl = `https://www.youtube.com/watch?v=${fileId}`
  try {
    logDebug('fetchVideoInfo <=', fileId)
    const myVideoInfo: videoInfo = await fetchVideoInfo(fileUrl)
    logDebug('fetchVideoInfo =>', myVideoInfo)
    const myMetadata: Metadata = transformVideoInfoToMetadata(myVideoInfo)
    const myS3File = transformVideoIntoS3File(myVideoInfo, process.env.Bucket)

    const videoUrl = myMetadata.formats[0].url
    const options: AxiosRequestConfig = {
      method: 'head',
      timeout: 900000,
      url: videoUrl
    }

    logDebug('axios <= ', options)
    const fileInfo = await axios(options)
    const {status, statusText, headers, config} = fileInfo
    logDebug('axios =>', {status, statusText, headers, config})

    // TODO: Ensure these headers exist in the response
    const bytesTotal = parseInt(fileInfo.headers['content-length'], 10)
    const contentType = fileInfo.headers['content-type']
    const key = myS3File.Key
    const bucket = process.env.Bucket // sourced via template.yaml
    const partSize = 1024 * 1024 * 5
    const params = {
      ACL: 'public-read',
      Bucket: process.env.Bucket,
      ContentType: contentType,
      Key: key,
      Metadata: myS3File.Metadata
    }
    logInfo('createMultipartUpload <=', params)
    const output = await createMultipartUpload(params)
    logInfo('createMultipartUpload =>', output)
    const newPartEnd = Math.min(partSize, bytesTotal)
    return {
      bucket,
      bytesRemaining: bytesTotal,
      bytesTotal,
      fileId,
      key,
      partBeg: 0,
      partEnd: newPartEnd - 1,
      partNumber: 1,
      partSize,
      partTags: [],
      uploadId: output.UploadId,
      url: videoUrl
    } as UploadPartEvent
  } catch (error) {
    logError(`startFileUpload <= ${error.message}`)
    throw new Error(error)
  }
}

export async function uploadFilePart(event: UploadPartEvent): Promise<CompleteFileUploadEvent | UploadPartEvent> {
  logInfo('event <=', event)
  try {
    const {bucket, bytesRemaining, bytesTotal, fileId, key, partBeg, partEnd, partNumber, partSize, partTags, uploadId, url} = event
    const options: AxiosRequestConfig = {
      headers: {Range: `bytes=${partBeg}-${partEnd}`},
      method: 'get',
      responseType: 'stream',
      url
    }

    logInfo('axios <=', options)
    const fileInfo = await axios(options)
    logDebug('axios.status =>', `${fileInfo.status} ${fileInfo.statusText}`)
    logDebug('axios.headers =>', fileInfo.headers)

    const params: UploadPartRequest = {
      Body: fileInfo.data,
      Bucket: bucket,
      ContentLength: fileInfo.headers['content-length'],
      Key: key,
      PartNumber: partNumber,
      UploadId: uploadId
    }
    const { Body, ...escapedParams } = params
    logInfo('uploadPart <=', escapedParams)
    const partData = await uploadPart(params)
    logInfo('uploadPart =>', partData)

    partTags.push({ETag: partData.ETag, PartNumber: partNumber})
    const newPartEnd = Math.min(partEnd + partSize, bytesTotal)
    const newBytesRemaining = bytesRemaining - partSize
    const nextPart: UploadPartEvent = {
      bucket,
      bytesRemaining: newBytesRemaining,
      bytesTotal,
      fileId,
      key,
      partBeg: partEnd + 1,
      partEnd: newPartEnd,
      partNumber: partNumber + 1,
      partSize,
      partTags,
      uploadId,
      url
    }
    if (newBytesRemaining < 0) {
      const finalPart = {
        bucket,
        bytesRemaining: 0,
        fileId,
        key,
        partTags,
        uploadId
      } as CompleteFileUploadEvent
      logDebug('response =>', finalPart)
      return finalPart
    } else {
      logDebug('response =>', nextPart)
      return nextPart
    }
  } catch (error) {
    throw new Error(error)
  }
}

export async function completeFileUpload(event: CompleteFileUploadEvent) {
  logDebug('event', event)
  try {
    const {bucket, fileId, key, partTags, uploadId} = event
    const params: CompleteMultipartUploadRequest = {
      Bucket: bucket,
      Key: key,
      MultipartUpload: {Parts: partTags},
      UploadId: uploadId
    }
    logInfo('completeMultipartUpload <=', params)
    const data = await completeMultipartUpload(params)
    logInfo('completeMultipartUpload =>', data)

    const updateItemParams = updateCompletedFileParams(process.env.DynamoDBTable, fileId, key)
    logDebug('updateItem <=', updateItemParams)
    const updateItemResponse = await updateItem(updateItemParams)
    logDebug('updateItem =>', updateItemResponse)

    return data
  } catch (error) {
    throw new Error(error)
  }
}

// TODO: Clean up the templates to support hardcoded bucket names
// Why do I have hard-coded S3 bucket names? The below links explain the challenge.
// https://www.itonaut.com/2018/10/03/implement-s3-bucket-lambda-triggers-in-aws-cloudformation/
// https://aws.amazon.com/premiumsupport/knowledge-center/unable-validate-circular-dependency-cloudformation/
// https://aws.amazon.com/blogs/mt/resolving-circular-dependency-in-provisioning-of-amazon-s3-buckets-with-aws-lambda-event-notifications/
export async function fileUploadWebhook(event: S3Event) {
  logDebug('event', event)
  const record = event.Records[0]
  const escapedKey = decodeURIComponent(record.s3.object.key).replace(/\+/g, ' ')
  const file = {
    ETag: record.s3.object.eTag,
    FileUrl: `https://${record.s3.bucket.name}.s3.amazonaws.com/${encodeURIComponent(escapedKey)}`,
    Key: escapedKey,
    LastModified: record.eventTime,
    Size: record.s3.object.size,
    StorageClass: 'STANDARD'
  }
  const publishParams: PublishInput = {
    Message: JSON.stringify({
      APNS_SANDBOX: JSON.stringify({aps: {'content-available': 1}, file: objectKeysToLowerCase(file)}),
      default: 'Default message'
    }),
    MessageAttributes: {
      'AWS.SNS.MOBILE.APNS.PRIORITY': {DataType: 'String', StringValue: '5'},
      'AWS.SNS.MOBILE.APNS.PUSH_TYPE': {DataType: 'String', StringValue: 'background'}
    },
    MessageStructure: 'json',
    TopicArn: process.env.PushNotificationTopicArn
  }
  try {
    logDebug('publishSnsEvent <=', publishParams)
    const publishResponse = await publishSnsEvent(publishParams)
    logDebug('publishSnsEvent <=', publishResponse)
    return {messageId: publishResponse.MessageId}
  } catch (error) {
    throw new Error(error)
  }
}

export async function handleClientEvent(event: APIGatewayEvent, context: Context) {
  const deviceId = event.headers['x-device-uuid']
  const message = event.body
  logInfo('Event received', {deviceId, message})
  return response(context, 204)
}

export async function schedulerFileCoordinator(event: APIGatewayEvent, context: Context) {
  logInfo('event', event)
  logInfo('context', context)
  const scanParams = scanForFileParams(process.env.DynamoDBTable)
  logDebug('scan <=', scanParams)
  const scanResponse = await scan(scanParams)
  logDebug('scan =>', scanResponse)
  for (const item of scanResponse.Items) {
    const params = {
      input: JSON.stringify({fileId: item.fileId}),
      name: (new Date()).getTime().toString(),
      stateMachineArn: process.env.StateMachineArn
    }
    logDebug('startExecution <=', params)
    const output = await startExecution(params)
    logDebug('startExecution =>', output)
  }
  return response(context, 200)
}

export async function handleRegisterUser(event: APIGatewayEvent, context: Context) {
  logInfo('event <=', event)
  const {requestBody, statusCode, message} = processEventAndValidate(event, registerUserConstraints)
  if (statusCode && message) {
    return response(context, statusCode, message)
  }
  const body = (requestBody as UserRegistration)

  logDebug('validateAuthCodeForToken <=')
  const appleToken = await validateAuthCodeForToken(body.authorizationCode)
  logDebug('validateAuthCodeForToken =>', appleToken)

  logDebug('verifyAppleToken <=')
  const verifiedToken = await verifyAppleToken(appleToken.id_token)
  logDebug('verifyAppleToken =>', verifiedToken)

  const user = {
    userId: uuidv4(),
    email: verifiedToken.email,
    emailVerified: verifiedToken.emailVerified,
    firstName: body.firstName,
    lastName: body.lastName
  }

  const identityProviderApple = {
    accessToken: appleToken.access_token,
    refreshToken: appleToken.refresh_token,
    tokenType: appleToken.token_type,
    expiresAt: new Date(Date.now() + appleToken.expires_in).getTime(),
    userId: verifiedToken.sub,
    email: verifiedToken.email,
    emailVerified: verifiedToken.email_verified,
    isPrivateEmail: verifiedToken.is_private_email
  }
  const putItemParams = newUserParams(process.env.DynamoDBTable, user, identityProviderApple)
  logDebug('putItem <=', putItemParams)
  const putItemResponse = await putItem(putItemParams)
  logDebug('putItem =>', putItemResponse)
  const token = await createAccessToken(user.userId)
  return response(context, 200, {token})
}

export async function handleLoginUser(event: APIGatewayEvent, context: Context) {
  logInfo('event <=', event)
  const token = await createAccessToken(uuidv4())
  return response(context, 200, {token})
}
