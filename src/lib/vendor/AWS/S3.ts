import {logError, logInfo} from '../../../util/lambda-helpers.js'
import {S3, CreateMultipartUploadRequest, CreateMultipartUploadOutput, CompleteMultipartUploadOutput, CompleteMultipartUploadRequest, UploadPartRequest, UploadPartOutput} from '@aws-sdk/client-s3'
const s3 = new S3()

export function createMultipartUpload(params: CreateMultipartUploadRequest): Promise<CreateMultipartUploadOutput> {
  return s3.createMultipartUpload(params)
}

export function completeMultipartUpload(params: CompleteMultipartUploadRequest): Promise<CompleteMultipartUploadOutput> {
  return s3.completeMultipartUpload(params)
}

export function uploadPart(partParams: UploadPartRequest, tryNum = 1): Promise<UploadPartOutput> {
  return new Promise((resolve, reject) => {
    s3.uploadPart(partParams, (multiErr, mData) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const {Body, ...escapedParams} = partParams
      logInfo('uploadPart <=', escapedParams)
      if (multiErr) {
        if (tryNum < 3) {
          uploadPart(partParams, tryNum + 1)
        } else {
          logError('uploadPart.error =>', mData)
          return reject(multiErr)
        }
        return
      }
      logInfo('uploadPart =>', mData)
      return resolve(mData as UploadPartOutput)
    })
  })
}
