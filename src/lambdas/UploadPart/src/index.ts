import { UploadPartRequest } from 'aws-sdk/clients/s3'
import axios, { AxiosRequestConfig } from 'axios'
import { uploadPart } from '../../../lib/vendor/AWS/S3'
import { CompleteFileUploadEvent, UploadPartEvent } from '../../../types/main'
import { logDebug, logInfo } from '../../../util/lambda-helpers'

export async function uploadFilePart(event: UploadPartEvent): Promise<CompleteFileUploadEvent | UploadPartEvent> {
  logInfo('event <=', event)
  try {
    const { bucket, bytesRemaining, bytesTotal, fileId, key, partBeg, partEnd, partNumber, partSize, partTags, uploadId, url } = event
    const options: AxiosRequestConfig = {
      headers: { Range: `bytes=${partBeg}-${partEnd}` },
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { Body, ...escapedParams } = params
    logInfo('uploadPart <=', escapedParams)
    const partData = await uploadPart(params)
    logInfo('uploadPart =>', partData)

    partTags.push({ ETag: partData.ETag, PartNumber: partNumber })
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
