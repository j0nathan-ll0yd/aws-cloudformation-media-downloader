import {createMultipartUpload} from '../../../lib/vendor/AWS/S3'
import {fetchVideoInfo, chooseVideoFormat} from '../../../lib/vendor/YouTube'
import {StartFileUploadParams, UploadPartEvent, DynamoDBFile} from '../../../types/main'
import {logDebug, logInfo} from '../../../util/lambda-helpers'
import {assertIsError} from '../../../util/transformers'
import {UnexpectedError} from '../../../util/errors'
import {CreateMultipartUploadRequest} from '@aws-sdk/client-s3'
import {upsertFile, makeHttpRequest} from '../../../util/shared'
import {AxiosRequestConfig} from 'axios'
import {FileStatus} from '../../../types/enums'

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
 * Starts a multipart upload of a file to an S3 bucket
 * @notExported
 */
export async function handler(event: StartFileUploadParams): Promise<UploadPartEvent> {
  logInfo('event <=', event)
  const fileId = event.fileId
  const fileUrl = `https://www.youtube.com/watch?v=${fileId}`
  try {
    logDebug('fetchVideoInfo <=', fileId)
    const videoInfo = await fetchVideoInfo(fileUrl)
    const selectedFormat = chooseVideoFormat(videoInfo)

    logDebug('Selected format:', {
      formatId: selectedFormat.format_id,
      filesize: selectedFormat.filesize,
      url: selectedFormat.url.substring(0, 50) + '...'
    })

    // Make HEAD request to get actual file size and content type
    const videoUrl = selectedFormat.url
    const headOptions: AxiosRequestConfig = {
      method: 'head',
      timeout: 900000,
      url: videoUrl
    }

    const fileInfo = await makeHttpRequest(headOptions)
    const bytesTotal = parseInt(fileInfo.headers['content-length'], 10)
    const contentType = fileInfo.headers['content-type']

    // Create DynamoDB item matching expected structure
    const fileName = `${videoInfo.id}.${selectedFormat.ext}`
    const myDynamoItem: DynamoDBFile = {
      fileId: videoInfo.id,
      key: fileName,
      size: bytesTotal,
      availableAt: new Date().getTime() / 1000,
      authorName: videoInfo.uploader || 'Unknown',
      authorUser: (videoInfo.uploader || 'unknown').toLowerCase().replace(/\s+/g, '_'),
      title: videoInfo.title,
      description: videoInfo.description || '',
      publishDate: videoInfo.upload_date || new Date().toISOString(),
      contentType,
      status: FileStatus.PendingDownload
    }

    await upsertFile(myDynamoItem)

    const key = fileName
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
      url: selectedFormat.url
    } as UploadPartEvent
  } catch (error) {
    assertIsError(error)
    throw new UnexpectedError(error.message)
  }
}
