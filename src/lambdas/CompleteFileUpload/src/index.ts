import {CompleteMultipartUploadOutput, CompleteMultipartUploadRequest} from 'aws-sdk/clients/s3'
import {updateItem} from '../../../lib/vendor/AWS/DynamoDB'
import {completeMultipartUpload} from '../../../lib/vendor/AWS/S3'
import {CompleteFileUploadEvent} from '../../../types/main'
import {updateCompletedFileParams} from '../../../util/dynamodb-helpers'
import {logDebug, logError, logInfo} from '../../../util/lambda-helpers'

export async function handler(event: CompleteFileUploadEvent): Promise<CompleteMultipartUploadOutput> {
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
    const fileUrl = `https://${bucket}.s3.amazonaws.com/${encodeURIComponent(key)}`
    const table = process.env.DynamoDBTableFiles as string
    const updateItemParams = updateCompletedFileParams(table, fileId, fileUrl)
    logDebug('updateItem <=', updateItemParams)
    const updateItemResponse = await updateItem(updateItemParams)
    logDebug('updateItem =>', updateItemResponse)
    return data
  } catch (error) {
    logError('Error completing file upload', error)
    throw error
  }
}
