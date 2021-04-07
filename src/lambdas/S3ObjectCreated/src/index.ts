import {S3Event} from 'aws-lambda'
import {logDebug} from '../../../util/lambda-helpers'

export async function fileUploadWebhook(event: S3Event) {
  logDebug('event', event)
  /*
  const record = event.Records[0]
  const escapedKey = decodeURIComponent(record.s3.object.key).replace(/\+/g, ' ')
  const file = {
    ETag: record.s3.object.eTag,
    FileUrl: `https://${record.s3.bucket.name}.s3.amazonaws.com/${encodeURIComponent(escapedKey)}`,
    Key: escapedKey,
    LastModified: record.eventTime,
    Size: record.s3.object.size,
    StorageClass: 'STANDARD'
  }
  */
  // TODO: Convert the file above to a MessageBody (transformDynamoDBFileToSQSMessageBodyAttributeMap)
  // TODO: Lookup users who requested this file
  // TODO: Dispatch push notification (via queues)
}
