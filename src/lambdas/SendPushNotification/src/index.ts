import {SQSEvent} from 'aws-lambda'
import {UserDevices} from '#entities/UserDevices'
import {Devices} from '#entities/Devices'
import {PublishInput, publishSnsEvent} from '#lib/vendor/AWS/SNS'
import {Device, FileNotification} from '#types/main'
import {logDebug, logError, logInfo} from '#util/lambda-helpers'
import {providerFailureErrorMessage, UnexpectedError} from '#util/errors'
import {assertIsError, transformFileNotificationToPushNotification} from '#util/transformers'
import {withXRay} from '#lib/vendor/AWS/XRay'

/**
 * Returns device IDs for a user
 * @param userId - The UUID of the user
 * @notExported
 */
async function getUserDevicesByUserId(userId: string): Promise<string[]> {
  logDebug('getUserDevicesByUserId <=', userId)
  const userResponse = await UserDevices.query.byUser({userId}).go()
  logDebug('getUserDevicesByUserId =>', userResponse)
  if (!userResponse || !userResponse.data) {
    return []
  }
  return userResponse.data.map((userDevice) => userDevice.deviceId)
}

/**
 * Retrieves a Device from DynamoDB (if it exists)
 * @param deviceId - The unique Device identifier
 * @notExported
 */
async function getDevice(deviceId: string): Promise<Device> {
  logDebug('getDevice <=', deviceId)
  const response = await Devices.get({deviceId}).go()
  logDebug('getDevice =>', response)
  if (response && response.data) {
    return response.data as Device
  } else {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
}

/**
 * After a File is downloaded, dispatch a notification to all UserDevices
 * @notExported
 */
export const handler = withXRay(async (event: SQSEvent): Promise<void> => {
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
})
