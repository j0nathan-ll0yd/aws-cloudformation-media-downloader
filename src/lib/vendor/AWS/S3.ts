import * as AWS from 'aws-sdk'
import { CompleteMultipartUploadOutput, CreateMultipartUploadOutput } from 'aws-sdk/clients/s3'
import * as S3 from 'aws-sdk/clients/s3'
const s3 = new AWS.S3({ apiVersion: '2006-03-01' })

export function createMultipartUpload(params: S3.CreateMultipartUploadRequest): Promise<CreateMultipartUploadOutput> {
  return s3.createMultipartUpload(params).promise()
}

export function completeMultipartUpload(params: S3.CompleteMultipartUploadRequest): Promise<CompleteMultipartUploadOutput> {
  return s3.completeMultipartUpload(params).promise()
}

export function uploadPart(partParams: S3.UploadPartRequest, tryNum?: number): Promise<S3.UploadPartOutput> {
  return new Promise((resolve, reject) => {
    if (!tryNum) {
      tryNum = 1
    }
    s3.uploadPart(partParams, (multiErr, mData) => {
      if (multiErr) {
        if (tryNum < 3) {
          uploadPart(partParams, tryNum + 1)
        } else {
          return reject(multiErr)
        }
        return
      }
      return resolve(mData)
    })
  })
}
