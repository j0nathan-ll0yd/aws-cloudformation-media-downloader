import {SQSEvent} from 'aws-lambda'
import {query} from '../../../lib/vendor/AWS/DynamoDB'
import {publishSnsEvent} from '../../../lib/vendor/AWS/SNS'
import {FileNotification} from '../../../types/main'
import {getUserDeviceByUserIdParams} from '../../../util/dynamodb-helpers'
import {logDebug} from '../../../util/lambda-helpers'
import * as transformers from '../../../util/transformers'

/**
 * Returns a UserDevice by userId
 * @param userId - The UUID of the user
 * @notExported
 */
async function getUserDeviceByUserId(userId: string) {
  const userParams = getUserDeviceByUserIdParams(process.env.DynamoDBTableUserDevices, userId)
  logDebug('query <=', userParams)
  const userResponse = await query(userParams)
  logDebug('query =>', userResponse)
  return userResponse
}

/**
 * After a File is downloaded, dispatch a notification to all UserDevices
 * @notExported
 */
export async function handler(event: SQSEvent): Promise<void> {
  logDebug('event', event)
  for (const record of event.Records) {
    try {
      const notificationType = record.body
      const userId = record.messageAttributes.userId.stringValue
      const userResponse = await getUserDeviceByUserId(userId)
      // There will always be 1 result; but with the possibility of multiple devices
      for (const userDevice of userResponse.Items[0].userDevice) {
        const targetArn = userDevice.endpointArn
        const publishParams = transformers[`transform${notificationType}ToPushNotification`](record.messageAttributes as FileNotification, targetArn)
        logDebug('publishSnsEvent <=', publishParams)
        const publishResponse = await publishSnsEvent(publishParams)
        logDebug('publishSnsEvent <=', publishResponse)
      }
    } catch (error) {
      throw new Error(error)
    }
  }
}
