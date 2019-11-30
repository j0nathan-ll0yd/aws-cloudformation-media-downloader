import {APIGatewayEvent, Context, CustomAuthorizerEvent, CustomAuthorizerResult} from 'aws-lambda'import axios, {AxiosRequestConfig} from 'axios'import {validate} from 'validate.js'import {videoInfo} from 'ytdl-core'import {getApiKeys, getUsage, getUsagePlans} from './lib/vendor/AWS/ApiGateway'import {completeMultipartUpload, createMultipartUpload, listObjects, uploadPart} from './lib/vendor/AWS/S3'import {startExecution} from './lib/vendor/AWS/StepFunctions'import {fetchVideoInfo} from './lib/vendor/YouTube'import {CompleteFileUploadEvent, ExtendedS3Object, Metadata, StartFileUploadEvent, UploadPartEvent} from './types/main'import {generateAllow, generateDeny} from './util/apigateway-helpers'import {feedlyEventConstraints} from './util/constraints'import {response} from './util/lambda-helpers'import {transformVideoInfoToMetadata, transformVideoIntoS3File} from './util/transformers'import {CompleteMultipartUploadRequest, UploadPartRequest} from '../node_modules/aws-sdk/clients/s3'import {StartExecutionInput} from '../node_modules/aws-sdk/clients/stepfunctions'export async function handleAuthorization(event: CustomAuthorizerEvent): Promise<CustomAuthorizerResult> {  console.info('Received event: ', JSON.stringify(event, null, 2))  // console.info('Received EV:', JSON.stringify(process.env, null, 2))  try {    const queryStringParameters = event.queryStringParameters    // This should always be defined, because it's governed by the API Gateway    const apiKeyValue = queryStringParameters.ApiKey    const apiKeyResponse = await getApiKeys({includeValues: true})    console.log('API Key data', JSON.stringify(apiKeyResponse, null, 2))    const matchedApiKeys = apiKeyResponse.items.filter((item) => item.value === apiKeyValue)    console.log('Matched API Key data', JSON.stringify(matchedApiKeys, null, 2))    console.log('Matched API Key data', matchedApiKeys.length)    if (matchedApiKeys.length > 0) {      const apiKey = matchedApiKeys[0]      if (apiKey.enabled === false) {        return generateDeny('me', event.methodArn)      }      console.log('Getting usage plans')      const usagePlansResponse = await getUsagePlans({keyId: apiKey.id})      console.log('Usage plans', JSON.stringify(usagePlansResponse, null, 2))      let responseObject = generateAllow('me', event.methodArn)      if (usagePlansResponse.items) {        const usagePlanId = usagePlansResponse.items[0].id        // MyUsagePlan: k9i2ri        // iOSApiKey: tfmmf65cag        // MyUsagePlanKey: tfmmf65cag:k9i2ri        const usageIdentifierKey = `${apiKey.id}:${usagePlansResponse.items[0].id}`        console.log(`usageIdentifierKey = ${usageIdentifierKey}`)        // does NOT work: apiKeyValue ? Testing now        // does NOT work: apiKey.id (aka keyId)        // does NOT work: usagePlanId        // TO TEST: usageIdentifierKey        responseObject = generateAllow('me', event.methodArn, apiKeyValue)        const usageDate = (new Date()).toISOString().split('T')[0]        const params = {          endDate: usageDate,          keyId: apiKey.id,          startDate: usageDate,          usagePlanId        }        console.log('Getting usage data with params ', JSON.stringify(params, null, 2))        const usageResponse = await getUsage(params)        console.log('Usage data', JSON.stringify(usageResponse, null, 2))      }      console.log('Responding with ', JSON.stringify(responseObject, null, 2))      return responseObject    }    console.log('Responding with ', JSON.stringify(generateDeny('me', event.methodArn), null, 2))    return generateDeny('me', event.methodArn)  } catch (error) {    console.error(error)    return generateDeny('me', event.methodArn)  }}export async function handleFeedlyEvent(event: APIGatewayEvent, context: Context) {  console.log('handleFeedlyEvent.event <=', JSON.stringify(event, null, 2))  console.log('handleFeedlyEvent.context <=', JSON.stringify(context, null, 2))  // TODO: verify that the body is actually JSON via API Gateway  const body = JSON.parse(event.body)  console.log('event.body', JSON.stringify(body, null, 2))  const invalidAttributes = validate(body, feedlyEventConstraints)  if (invalidAttributes) {    return response(context, 400, invalidAttributes)  }  try {    console.log(`fetchVideoInfo <= ${body.ArticleURL}`)    const myVideoInfo: videoInfo = await fetchVideoInfo(body.ArticleURL)    console.log('fetchVideoInfo =>', JSON.stringify(myVideoInfo, null, 2))    const myMetadata: Metadata = transformVideoInfoToMetadata(myVideoInfo)    const myS3File = transformVideoIntoS3File(myVideoInfo, process.env.Bucket)    const url = myMetadata.formats[0].url    const options: AxiosRequestConfig = {      method: 'head',      timeout: 1000,      url    }    console.log('axios <= ', JSON.stringify(options, null, 2))    const fileInfo = await axios(options)    const {status, statusText, headers, config} = fileInfo    console.log('axios =>', JSON.stringify({status, statusText, headers, config}, null, 2))    // check for Accept-Ranges: bytes header    // check for Content-Length header    const params: StartExecutionInput = {      input: JSON.stringify({        bucket: process.env.Bucket,        bytesTotal: parseInt(fileInfo.headers['content-length'], 10),        contentType: fileInfo.headers['content-type'],        key: myS3File.Key,        metaData: myS3File.Metadata,        url      } as StartFileUploadEvent),      name: (new Date()).getTime().toString(),      stateMachineArn: process.env.StateMachineArn    }    console.log('startExecution <=', JSON.stringify(params, null, 2))    const data = await startExecution(params)    console.log('startExecution =>', JSON.stringify(data, null, 2))    return response(context, 202, myMetadata)  } catch (error) {    console.error(error)    return response(context, 500, error.message)  }}export async function listFiles(event: APIGatewayEvent, context: Context) {  console.log('listFiles.event', JSON.stringify(event, null, 2))  console.log('listFiles.context', JSON.stringify(context, null, 2))  try {    const params = {Bucket: process.env.Bucket, MaxKeys: 1000}    console.log('listObjects <=', JSON.stringify(params, null, 2))    const files = await listObjects({Bucket: process.env.Bucket, MaxKeys: 1000})    console.log('listObjects =>', JSON.stringify(files, null, 2))    files.Contents.forEach((file: ExtendedS3Object) => {      // tslint:disable-next-line:max-line-length      // https://lifegames-app-s3bucket-pq2lluyi2i12.s3.amazonaws.com/20150402-%5Bcondenasttraveler%5D-Shorties%20Winner%3A%20One%20Year%20of%20Travel%20in%20One%20Minute.mp4      file.FileUrl = `https://${files.Name}.s3.amazonaws.com/${encodeURIComponent(file.Key)}`      return file    })    return response(context, 200, files)  } catch (error) {    console.error(error)    throw new Error(error)  }}export async function startFileUpload(event): Promise<UploadPartEvent> {  console.log('startFileUpload.event', JSON.stringify(event, null, 2))  try {    const partSize = 1024 * 1024 * 5    // Minimum 5MB per chunk (except the last part)    // http://docs.aws.amazon.com/AmazonS3/latest/API/mpUploadComplete.html    const {bucket, key, metaData, url, contentType, bytesTotal} = event    const params = {Bucket: bucket, ContentType: contentType, Key: key, Metadata: metaData}    console.info('createMultipartUpload <=', JSON.stringify(params, null, 2))    const output = await createMultipartUpload(params)    console.info('createMultipartUpload =>', JSON.stringify(output, null, 2))    const newPartEnd = Math.min(partSize, bytesTotal)    return {      bucket,      bytesRemaining: parseInt(bytesTotal, 10),      bytesTotal: parseInt(bytesTotal, 10),      key,      partBeg: 0,      partEnd: newPartEnd - 1,      partNumber: 1,      partSize,      partTags: [],      uploadId: output.UploadId,      url    } as UploadPartEvent  } catch (error) {    console.error(error)    throw new Error(error)  }}export async function uploadFilePart(event: UploadPartEvent): Promise<CompleteFileUploadEvent|UploadPartEvent> {  console.log('uploadFilePart.event', JSON.stringify(event, null, 2))  try {    const {bucket, bytesRemaining, bytesTotal, key, partBeg, partEnd, partNumber, partSize, partTags, uploadId, url} = event    const options: AxiosRequestConfig = {      headers: {Range: `bytes=${partBeg}-${partEnd}`},      method: 'get',      responseType: 'stream',      url    }    console.info('Requesting ', url)    const fileInfo = await axios(options)    console.log('Fileinfo Data', fileInfo.data)    console.log('Fileinfo Status1', fileInfo.status, fileInfo.statusText)    console.log('Fileinfo Headers', JSON.stringify(fileInfo.headers, null, 2))    const params: UploadPartRequest = {      Body: fileInfo.data,      Bucket: bucket,      ContentLength: fileInfo.headers['content-length'],      Key: key,      PartNumber: partNumber,      UploadId: uploadId    }    const partData = await uploadPart(params)    console.log('Completed part', partNumber)    console.log('partData', JSON.stringify(partData, null, 2))    partTags.push({ETag: partData.ETag, PartNumber: partNumber})    const newPartEnd = Math.min(partEnd + partSize, bytesTotal)    const newBytesRemaining = bytesRemaining - partSize    const nextPart: UploadPartEvent = {      bucket,      bytesRemaining: newBytesRemaining,      bytesTotal,      key,      partBeg: partEnd + 1,      partEnd: newPartEnd,      partNumber: partNumber + 1,      partSize,      partTags,      uploadId,      url    }    if (newBytesRemaining < 0) {      const finalPart = {        bucket,        bytesRemaining: 0,        key,        partTags,        uploadId      } as CompleteFileUploadEvent      console.log('Returning finalPart', finalPart)      return finalPart    } else {      console.log('Returning nextPart', nextPart)      return nextPart    }  } catch (error) {    console.log(error)    throw new Error(error)  }}export async function completeFileUpload(event: CompleteFileUploadEvent) {  console.log('completeFileUpload.event', JSON.stringify(event, null, 2))  try {    const {bucket, key, partTags, uploadId} = event    const params: CompleteMultipartUploadRequest = {      Bucket: bucket,      Key: key,      MultipartUpload: {Parts: partTags},      UploadId: uploadId    }    console.info('completeMultipartUpload <=', JSON.stringify(params, null, 2))    const data = await completeMultipartUpload(params)    console.info('completeMultipartUpload =>', JSON.stringify(data, null, 2))    return data  } catch (error) {    console.error(error)    throw new Error(error)  }}