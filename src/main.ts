import {APIGatewayEvent, Context, CustomAuthorizerEvent, CustomAuthorizerResult} from 'aws-lambda'
import {StartExecutionInput} from 'aws-sdk/clients/stepfunctions'
import axios, {AxiosRequestConfig} from 'axios'
import {validate} from 'validate.js'
import {videoInfo} from 'ytdl-core'
import {CompleteMultipartUploadRequest, UploadPartRequest} from '../node_modules/aws-sdk/clients/s3'
import {getApiKeys, getUsage, getUsagePlans} from './lib/vendor/AWS/ApiGateway'
import {completeMultipartUpload, createMultipartUpload, listObjects, uploadPart} from './lib/vendor/AWS/S3'
import {createPlatformEndpoint} from './lib/vendor/AWS/SNS'
import {startExecution} from './lib/vendor/AWS/StepFunctions'
import {fetchVideoInfo} from './lib/vendor/YouTube'
import {
  CompleteFileUploadEvent,
  DeviceRegistration,
  ExtendedS3Object,
  Metadata,
  UploadPartEvent
} from './types/main'
import {ScheduledEvent} from './types/vendor/Amazon/CloudWatch/ScheduledEvent'
import {Webhook} from './types/vendor/IFTTT/Feedly/Webhook'
import {generateAllow, generateDeny} from './util/apigateway-helpers'
import {feedlyEventConstraints, registerDeviceConstraints} from './util/constraints'
import {logDebug, logError, logInfo, response} from './util/lambda-helpers'
import {objectKeysToLowerCase, transformVideoInfoToMetadata, transformVideoIntoS3File} from './util/transformers'

function processEventAndValidate(event: APIGatewayEvent | ScheduledEvent, constraints?) {
  let requestBody: Webhook | DeviceRegistration
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
      logError('processEventAndValidate =>   ', invalidAttributes)
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
    const params: StartExecutionInput = {
      input: JSON.stringify({fileUrl: body.articleURL}),
      name: (new Date()).getTime().toString(),
      stateMachineArn: process.env.StateMachineArn
    }
    logDebug('startExecution <=', params)
    const data = await startExecution(params)
    logDebug('startExecution =>', data)
    return response(context, 202, {status: 'ExecutionStarted'})
  } catch (error) {
    logError('response =>', error)
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
  const params = {
    Attributes: {UserId: '1234', ChannelId: '1234'},
    PlatformApplicationArn: process.env.PlatformApplicationArn,
    Token: body.token
  }
  logDebug('createPlatformEndpoint <=', params)
  const data = await createPlatformEndpoint(params)
  logDebug('createPlatformEndpoint =>', data)
  return response(context, 201, {endpointArn: data.EndpointArn})
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
    logError('response =>', error)
    throw new Error(error)
  }
}

export async function startFileUpload(event): Promise<UploadPartEvent> {
  logInfo('event <=', event)
  try {
    const {fileUrl} = event
    logDebug('fetchVideoInfo <=', fileUrl)
    const myVideoInfo: videoInfo = await fetchVideoInfo(fileUrl)
    logDebug('fetchVideoInfo =>', myVideoInfo)
    const myMetadata: Metadata = transformVideoInfoToMetadata(myVideoInfo)
    const myS3File = transformVideoIntoS3File(myVideoInfo, process.env.Bucket)

    const videoUrl = myMetadata.formats[0].url
    const options: AxiosRequestConfig = {
      method: 'head',
      timeout: 1000,
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
    logError('response =>', error)
    throw new Error(error)
  }
}

export async function uploadFilePart(event: UploadPartEvent): Promise<CompleteFileUploadEvent | UploadPartEvent> {
  logInfo('event <=', event)
  try {
    const {bucket, bytesRemaining, bytesTotal, key, partBeg, partEnd, partNumber, partSize, partTags, uploadId, url} = event
    const options: AxiosRequestConfig = {
      headers: {Range: `bytes=${partBeg}-${partEnd}`},
      method: 'get',
      responseType: 'stream',
      url
    }

    logInfo('axios <=', url)
    const fileInfo = await axios(options)
    logDebug('axios.fileInfo.data =>', fileInfo.data)
    logDebug('axios.fileInfo.status =>', `${fileInfo.status} ${fileInfo.statusText}`)
    logDebug('axios.fileInfo.headers =>', fileInfo.headers)

    const params: UploadPartRequest = {
      Body: fileInfo.data,
      Bucket: bucket,
      ContentLength: fileInfo.headers['content-length'],
      Key: key,
      PartNumber: partNumber,
      UploadId: uploadId
    }
    logInfo('uploadPart <=', params)
    const partData = await uploadPart(params)
    logInfo('uploadPart =>', partData)

    partTags.push({ETag: partData.ETag, PartNumber: partNumber})
    const newPartEnd = Math.min(partEnd + partSize, bytesTotal)
    const newBytesRemaining = bytesRemaining - partSize
    const nextPart: UploadPartEvent = {
      bucket,
      bytesRemaining: newBytesRemaining,
      bytesTotal,
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
    logError('response =>', error)
    throw new Error(error)
  }
}

export async function completeFileUpload(event: CompleteFileUploadEvent) {
  logDebug('event', event)
  try {
    const {bucket, key, partTags, uploadId} = event
    const params: CompleteMultipartUploadRequest = {
      Bucket: bucket,
      Key: key,
      MultipartUpload: {Parts: partTags},
      UploadId: uploadId
    }
    logInfo('completeMultipartUpload <=', params)
    const data = await completeMultipartUpload(params)
    logInfo('completeMultipartUpload =>', data)
    return data
  } catch (error) {
    logError('response =>', error)
    throw new Error(error)
  }
}
