import {S3Event} from 'aws-lambda'
import {PublishInput} from 'aws-sdk/clients/sns'
import {publishSnsEvent} from '../../../lib/vendor/AWS/SNS'
import {logDebug} from '../../../util/lambda-helpers'
import {objectKeysToLowerCase} from '../../../util/transformers'

export async function fileUploadWebhook(event: S3Event) {
  logDebug('event', event)
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

  const publishParams: PublishInput = {
    Message: JSON.stringify({
      APNS_SANDBOX: JSON.stringify({aps: {'content-available': 1}, file: objectKeysToLowerCase(file)}),
      default: 'Default message'
    }),
    MessageAttributes: {
      'AWS.SNS.MOBILE.APNS.PRIORITY': {DataType: 'String', StringValue: '5'},
      'AWS.SNS.MOBILE.APNS.PUSH_TYPE': {DataType: 'String', StringValue: 'background'}
    },
    MessageStructure: 'json',
    TopicArn: process.env.PushNotificationTopicArn
  }
  try {
    logDebug('publishSnsEvent <=', publishParams)
    const publishResponse = await publishSnsEvent(publishParams)
    logDebug('publishSnsEvent <=', publishResponse)
    return {messageId: publishResponse.MessageId}
  } catch (error) {
    throw new Error(error)
  }
  // TODO: Convert the file above to a MessageBody (transformDynamoDBFileToSQSMessageBodyAttributeMap)
  // TODO: Lookup users who requested this file
  // TODO: Dispatch push notification (via queues)
}
