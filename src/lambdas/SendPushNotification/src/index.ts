import {SQSEvent} from 'aws-lambda'
import {query} from '../../../lib/vendor/AWS/DynamoDB'
import {publishSnsEvent} from '../../../lib/vendor/AWS/SNS'
import {DynamoDBUserDevice, FileNotification} from '../../../types/main'
import {getUserDeviceByUserIdParams} from '../../../util/dynamodb-helpers'
import {logDebug, logInfo} from '../../../util/lambda-helpers'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors'
import {assertIsError, transformFileNotificationToPushNotification} from '../../../util/transformers'

/**
 * Returns a UserDevice by userId
 * @param userId - The UUID of the user
 * @notExported
 */
async function getUserDeviceByUserId(userId: string): Promise<DynamoDBUserDevice[]> {
  const userParams = getUserDeviceByUserIdParams(process.env.DynamoDBTableUserDevices as string, userId)
  logDebug('query <=', userParams)
  const userResponse = await query(userParams)
  logDebug('query =>', userResponse)
  if (!userResponse || !Array.isArray(userResponse.Items)) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return userResponse.Items as DynamoDBUserDevice[]
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
      if (notificationType !== 'FileNotification') {
        return
      }
      const userId = record.messageAttributes.userId.stringValue as string
      const userDeviceItems = await getUserDeviceByUserId(userId)
      if (userDeviceItems.length == 0) {
        return
      }
      // There will always be 1 result; but with the possibility of multiple devices
      for (const userDevice of userDeviceItems) {
        const targetArn = userDevice.userDevice.endpointArn
        logInfo(`Sending ${notificationType} to targetArn`, targetArn)
        const publishParams = transformFileNotificationToPushNotification(record.messageAttributes as FileNotification, targetArn)
        logDebug('publishSnsEvent <=', publishParams)
        const publishResponse = await publishSnsEvent(publishParams)
        logDebug('publishSnsEvent <=', publishResponse)
      }
    } catch (error) {
      assertIsError(error)
      throw new UnexpectedError(error.message)
    }
  }
}
