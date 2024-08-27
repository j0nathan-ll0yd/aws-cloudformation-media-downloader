import {createMultipartUpload} from '../../../lib/vendor/AWS/S3'
import {fetchVideoInfo} from '../../../lib/vendor/YouTube'
import {Metadata, StartFileUploadParams, UploadPartEvent} from '../../../types/main'
import {logDebug, logInfo} from '../../../util/lambda-helpers'
import {assertIsError} from '../../../util/transformers'
import {UnexpectedError} from '../../../util/errors'
import {CreateMultipartUploadRequest} from '@aws-sdk/client-s3'
import {getFileFromMetadata, upsertFile} from '../../../util/shared'

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
    const myMetadata: Metadata = await fetchVideoInfo(fileUrl)
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
      url: myMetadata.videoUrl
    } as UploadPartEvent
  } catch (error) {
    assertIsError(error)
    throw new UnexpectedError(error.message)
  }
}
