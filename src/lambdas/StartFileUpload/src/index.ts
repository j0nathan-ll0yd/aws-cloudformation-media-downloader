import {AxiosRequestConfig} from 'axios'
import {videoInfo} from 'ytdl-core'
import {updateItem} from '../../../lib/vendor/AWS/DynamoDB'
import {createMultipartUpload} from '../../../lib/vendor/AWS/S3'
import {fetchVideoInfo} from '../../../lib/vendor/YouTube'
import {DynamoDBFile, Metadata, StartFileUploadParams, UploadPartEvent} from '../../../types/main'
import {updateFileMetadataParams} from '../../../util/dynamodb-helpers'
import {logDebug, logInfo, makeHttpRequest} from '../../../util/lambda-helpers'
import {assertIsError, transformVideoInfoToMetadata, transformVideoIntoDynamoItem} from '../../../util/transformers'
import {UnexpectedError} from '../../../util/errors'
import {CreateMultipartUploadRequest} from 'aws-sdk/clients/s3'

/**
 * Upsert a File object in DynamoDB
 * @param item - The DynamoDB item to be added
 * @notExported
 */
async function upsertFile(item: DynamoDBFile) {
  const updateItemParams = updateFileMetadataParams(process.env.DynamoDBTableFiles as string, item)
  logDebug('updateItem <=', updateItemParams)
  const updateResponse = await updateItem(updateItemParams)
  logDebug('updateItem =>', updateResponse)
  return updateResponse
}

/**
 * Create a start for a multi-part upload
 * @param params - The CreateMultipartUploadRequest object
 * @notExported
 */
async function createMultipartUploadFromParams(params: CreateMultipartUploadRequest) {
  logInfo('createMultipartUpload <=', params)
  const output = await createMultipartUpload(params)
  logInfo('createMultipartUpload =>', output)
  return output
}

/**
 * Create a DynamoDBFile object from a video's metadata
 * @param metadata - The Metadata for a video; generated through youtube-dl
 * @returns DynamoDBFile
 * @notExported
 */
async function getFileFromMetadata(metadata: Metadata): Promise<DynamoDBFile> {
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
  return myDynamoItem
}

/**
 * Starts a multipart upload of a file to an S3 bucket
 * @notExported
 */
export async function handler(event: StartFileUploadParams): Promise<UploadPartEvent> {
  logInfo('event <=', event)
  const fileId = event.fileId
  const fileUrl = `https://www.youtube.com/watch?v=${fileId}`
  try {
    logDebug('fetchVideoInfo <=', fileId)
    const myVideoInfo: videoInfo = await fetchVideoInfo(fileUrl)
    const myMetadata: Metadata = transformVideoInfoToMetadata(myVideoInfo)
    const myDynamoItem = await getFileFromMetadata(myMetadata)
    await upsertFile(myDynamoItem)

    const key = myMetadata.fileName
    const bytesTotal = myDynamoItem.size
    const bucket = process.env.Bucket
    const partSize = 1024 * 1024 * 5
    const params = {
      ACL: 'public-read',
      Bucket: bucket,
      ContentType: myDynamoItem.contentType,
      Key: key
    } as CreateMultipartUploadRequest
    const output = await createMultipartUploadFromParams(params)
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
      url: myMetadata.formats[0].url
    } as UploadPartEvent
  } catch (error) {
    assertIsError(error)
    throw new UnexpectedError(error.message)
  }
}
