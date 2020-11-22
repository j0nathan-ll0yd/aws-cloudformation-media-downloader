// TODO: Clean up the templates to support hardcoded bucket names
// Why do I have hard-coded S3 bucket names? The below links explain the challenge.
// https://www.itonaut.com/2018/10/03/implement-s3-bucket-lambda-triggers-in-aws-cloudformation/
// https://aws.amazon.com/premiumsupport/knowledge-center/unable-validate-circular-dependency-cloudformation/
// https://aws.amazon.com/blogs/mt/resolving-circular-dependency-in-provisioning-of-amazon-s3-buckets-with-aws-lambda-event-notifications/
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
}
