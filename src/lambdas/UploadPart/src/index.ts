import {UploadPartRequest} from '@aws-sdk/client-s3'
import {AxiosRequestConfig} from 'axios'
import {uploadPart} from '../../../lib/vendor/AWS/S3'
import {CompleteFileUploadEvent, UploadPartEvent} from '../../../types/main'
import {logDebug, logInfo} from '../../../util/lambda-helpers'
import {UnexpectedError} from '../../../util/errors'
import {assertIsError} from '../../../util/transformers'
import {makeHttpRequest} from '../../../util/shared'

/**
 * Uploads a part (by byte range) of a file to an S3 bucket
 * @notExported
 */
export async function handler(event: UploadPartEvent): Promise<CompleteFileUploadEvent | UploadPartEvent> {
  logInfo('event <=', event)
  try {
    const {bucket, bytesRemaining, bytesTotal, fileId, key, partBeg, partEnd, partNumber, partSize, partTags, uploadId, url} = event
    const options: AxiosRequestConfig = {
      headers: {Range: `bytes=${partBeg}-${partEnd}`},
      method: 'get',
      responseType: 'stream',
      url
    }

    const fileInfo = await makeHttpRequest(options)
    const params: UploadPartRequest = {
      Body: fileInfo.data,
      Bucket: bucket,
      ContentLength: parseInt(fileInfo.headers['content-length']),
      Key: key,
      PartNumber: partNumber,
      UploadId: uploadId
    }

    const partData = await uploadPart(params)
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
    assertIsError(error)
    throw new UnexpectedError(error.message)
  }
}
