import {AxiosRequestConfig} from 'axios'
import {videoInfo} from 'ytdl-core'
import {updateItem} from '../../../lib/vendor/AWS/DynamoDB'
import {createMultipartUpload} from '../../../lib/vendor/AWS/S3'
import {fetchVideoInfo} from '../../../lib/vendor/YouTube'
import {Metadata, StartFileUploadParams, UploadPartEvent} from '../../../types/main'
import {updateFileMetadataParams} from '../../../util/dynamodb-helpers'
import {logDebug, logError, logInfo, makeHttpRequest} from '../../../util/lambda-helpers'
import {transformVideoInfoToMetadata, transformVideoIntoDynamoItem} from '../../../util/transformers'
import { UnexpectedError } from "../../../util/errors"

/**
 * Starts a multi-part upload of a file to an S3 bucket
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
    const myDynamoItem = transformVideoIntoDynamoItem(myMetadata)

    const videoUrl = myMetadata.formats[0].url
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
    myDynamoItem.publishDate = new Date(myMetadata.published).toISOString()
    myDynamoItem.contentType = contentType
    const updateItemParams = updateFileMetadataParams(process.env.DynamoDBTableFiles, myDynamoItem)
    logDebug('updateItem <=', updateItemParams)
    const updateResponse = await updateItem(updateItemParams)
    logDebug('updateItem =>', updateResponse)

    const key = myMetadata.fileName
    const bucket = process.env.Bucket // sourced via template.yaml
    const partSize = 1024 * 1024 * 5
    const params = {
      ACL: 'public-read',
      Bucket: process.env.Bucket,
      ContentType: contentType,
      Key: key
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
    logError('error', error)
    throw new UnexpectedError(error.message)
  }
}
