import {SQSEvent} from 'aws-lambda'
import {query} from '../../../lib/vendor/AWS/DynamoDB'
import {publishSnsEvent} from '../../../lib/vendor/AWS/SNS'
import {Device, DynamoDBUserDevice, FileNotification} from '../../../types/main'
import {getUserDeviceByUserIdParams, queryDeviceParams} from '../../../util/dynamodb-helpers'
import {logDebug, logInfo} from '../../../util/lambda-helpers'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors'
import {assertIsError, transformFileNotificationToPushNotification} from '../../../util/transformers'

/**
 * Returns a Device by userId
 * @param userId - The UUID of the user
 * @notExported
 */
async function getUserDevicesByUserId(userId: string): Promise<string[]> {
  const userParams = getUserDeviceByUserIdParams(process.env.DynamoDBTableUserDevices as string, userId)
  logDebug('getUserDevicesByUserId <=', userParams)
  const userResponse = await query(userParams)
  logDebug('getUserDevicesByUserId =>', userResponse)
  if (!userResponse || !Array.isArray(userResponse.Items)) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  // There will always be 1 result; but with the possibility of multiple devices
  const userDevice = userResponse.Items[0] as DynamoDBUserDevice
  return userDevice.devices.values as string[]
}

/**
 * Retrieves a Device from DynamoDB (if it exists)
 * @param deviceId - The unique Device identifier
 * @notExported
 */
async function getDevice(deviceId: string): Promise<Device> {
  const params = queryDeviceParams(process.env.DynamoDBTableDevices as string, deviceId)
  logDebug('getDevice <=', params)
  const response = await query(params)
  logDebug('getDevice =>', response)
  if (response.Items && response.Items.length > 0) {
    return response.Items[0] as Device
  }
  throw new UnexpectedError(providerFailureErrorMessage)
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
      const deviceIds = await getUserDevicesByUserId(userId)
      logDebug('typeof deviceIds <=', typeof deviceIds)
      if (deviceIds.length == 0) {
        return
      }
      logInfo('Sending messages to devices <=', deviceIds)
      for (const deviceId of deviceIds) {
        logDebug('typeof deviceId <=', typeof deviceId)
        logInfo('Sending messages to deviceId <=', deviceId)
        const device = await getDevice(deviceId)
        const targetArn = device.endpointArn as string
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
