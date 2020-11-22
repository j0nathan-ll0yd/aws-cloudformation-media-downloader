import {CompleteMultipartUploadRequest} from 'aws-sdk/clients/s3'
import {updateItem} from '../../../lib/vendor/AWS/DynamoDB'
import {completeMultipartUpload} from '../../../lib/vendor/AWS/S3'
import {CompleteFileUploadEvent} from '../../../types/main'
import {updateCompletedFileParams} from '../../../util/dynamodb-helpers'
import {logDebug, logInfo} from '../../../util/lambda-helpers'

export async function completeFileUpload(event: CompleteFileUploadEvent) {
  logDebug('event', event)
  try {
    const {bucket, fileId, key, partTags, uploadId} = event
    const params: CompleteMultipartUploadRequest = {
      Bucket: bucket,
      Key: key,
      MultipartUpload: {Parts: partTags},
      UploadId: uploadId
    }
    logInfo('completeMultipartUpload <=', params)
    const data = await completeMultipartUpload(params)
    logInfo('completeMultipartUpload =>', data)

    const updateItemParams = updateCompletedFileParams(process.env.DynamoDBTable, fileId, key)
    logDebug('updateItem <=', updateItemParams)
    const updateItemResponse = await updateItem(updateItemParams)
    logDebug('updateItem =>', updateItemResponse)

    return data
  } catch (error) {
    throw new Error(error)
  }
}