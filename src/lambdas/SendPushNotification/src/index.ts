import {SQSEvent} from 'aws-lambda'
import {query} from '../../../lib/vendor/AWS/DynamoDB.js'
import {publishSnsEvent} from '../../../lib/vendor/AWS/SNS.js'
import {Device, DynamoDBUserDevice, FileNotification} from '../../../types/main'
import {getUserDeviceByUserIdParams, queryDeviceParams} from '../../../util/dynamodb-helpers.js'
import {logDebug, logError, logInfo} from '../../../util/lambda-helpers.js'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors.js'
import {assertIsError, transformFileNotificationToPushNotification} from '../../../util/transformers.js'
import {PublishInput} from '@aws-sdk/client-sns'

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
  if (userResponse.Items.length === 0) {
    return []
  }
  // There will always be 1 result (if the user has a device); but with the possibility of multiple devices
  const userDevice = userResponse.Items[0] as unknown as DynamoDBUserDevice
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
  if (response && response.Items && response.Items.length > 0) {
    return response.Items[0] as unknown as Device
  } else {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
}

/**
 * After a File is downloaded, dispatch a notification to all UserDevices
 * @notExported
 */
export async function handler(event: SQSEvent): Promise<void> {
  logDebug('event', event)
  for (const record of event.Records) {
    const notificationType = record.body
    if (notificationType !== 'FileNotification') {
      return
    }
    const userId = record.messageAttributes.userId.stringValue as string
    const deviceIds = await getUserDevicesByUserId(userId)
    if (deviceIds.length == 0) {
      return
    }
    logInfo('Sending messages to devices <=', deviceIds)
    for (const deviceId of deviceIds) {
      try {
        logInfo('Sending messages to deviceId <=', deviceId)
        const device = await getDevice(deviceId)
        const targetArn = device.endpointArn as string
        logInfo(`Sending ${notificationType} to targetArn`, targetArn)
        const publishParams = transformFileNotificationToPushNotification(record.messageAttributes as FileNotification, targetArn) as PublishInput
        logDebug('publishSnsEvent <=', publishParams)
        const publishResponse = await publishSnsEvent(publishParams)
        logDebug('publishSnsEvent <=', publishResponse)
      } catch (error) {
        assertIsError(error)
        logError('publishSnsEvent <=', error.message)
      }
    }
  }
}
