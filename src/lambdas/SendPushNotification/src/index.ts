import {SQSEvent} from 'aws-lambda'
import {logDebug} from '../../../util/lambda-helpers'

export async function index(event: SQSEvent) {
  logDebug('event', event)

  /*
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
  */
}
