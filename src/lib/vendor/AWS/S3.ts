import * as AWS from 'aws-sdk'
import {CompleteMultipartUploadOutput, CreateMultipartUploadOutput} from 'aws-sdk/clients/s3'
import * as S3 from 'aws-sdk/clients/s3'
import * as AWSXRay from 'aws-xray-sdk'
//const s3 = AWSXRay.captureAWSClient(new AWS.S3({apiVersion: '2006-03-01'}))
const s3 = new AWS.S3({apiVersion: '2006-03-01'})

export function uploadToS3(params) {
  return new Promise((resolve, reject) => {

    const upload = new S3.ManagedUpload({
      params,
      partSize: 10 * 1024 * 1024,
      queueSize: 100
    })

    upload.on('httpUploadProgress', (progress) => console.debug('Progress', JSON.stringify(progress)))
    upload.send((err, data) => {
      if (err) {
        console.error(err)
        return reject(err)
      } else {
        console.debug('Upload complete', JSON.stringify(data))
        return resolve(data)
      }
    })
  })
}

export function createMultipartUpload(params: S3.CreateMultipartUploadRequest): Promise<CreateMultipartUploadOutput> {
  return new Promise((resolve, reject) => {
    console.log('Creating multipart upload for:', params.Key)
    s3.createMultipartUpload(params, (error, multipart) => {
      if (error) {
        console.error(error)
        return reject(error)
      }
      return resolve(multipart)
    })
  })
}

export function completeMultipartUpload(params: S3.CompleteMultipartUploadRequest): Promise<CompleteMultipartUploadOutput> {
  return new Promise((resolve, reject) => {
    console.log('Completing multipart upload for:', params.Key)
    s3.completeMultipartUpload(params, (err, data) => {
      if (err) {
        console.log('An error occurred while completing the multipart upload')
        console.log(err)
        reject(err)
      } else {
        // const delta: number = +(new Date() - startTime) / 1000
        // console.log('Completed upload in', delta, 'seconds')
        console.log('Final upload data:', data)
        resolve(data)
      }
    })
  })
}

export function uploadPart(partParams: S3.UploadPartRequest, tryNum?): Promise<S3.UploadPartOutput> {
  return new Promise((resolve, reject) => {
    if (!tryNum) {
      tryNum = 1
    }
    s3.uploadPart(partParams, (multiErr, mData) => {
      if (multiErr) {
        console.log('multiErr, upload part error:', multiErr)
        if (tryNum < 3) {
          console.log('Retrying upload of part: #', partParams.PartNumber)
          uploadPart(partParams, tryNum + 1)
        } else {
          console.log('Failed uploading part: #', partParams.PartNumber)
          return reject(multiErr)
        }
        return
      }
      return resolve(mData)
    })
  })
}

// TODO: Add a call to get object metadata and pass it to the API
// https://gist.github.com/mihaiserban/1f35d488405812f2bbd4b16e38e4afb5
export function listObjects(params: S3.ListObjectsV2Request): Promise<S3.ListObjectsV2Output> {
  return new Promise((resolve, reject) => {
    s3.listObjectsV2(params, (error, data) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
}
