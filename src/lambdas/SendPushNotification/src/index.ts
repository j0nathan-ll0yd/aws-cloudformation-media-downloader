import {SQSEvent} from 'aws-lambda'
import {UserDevices} from '#entities/UserDevices'
import {Devices} from '#entities/Devices'
import {PublishInput, publishSnsEvent} from '#lib/vendor/AWS/SNS'
import {Device, FileNotificationType} from '#types/main'
import {logDebug, logError, logInfo} from '#util/lambda-helpers'
import {providerFailureErrorMessage, UnexpectedError} from '#util/errors'
import {assertIsError, transformToAPNSNotification} from '#util/transformers'
import {withXRay} from '#lib/vendor/AWS/XRay'

const SUPPORTED_NOTIFICATION_TYPES: FileNotificationType[] = ['MetadataNotification', 'DownloadReadyNotification']

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
 * Dispatches push notifications to all user devices
 * Supports MetadataNotification and DownloadReadyNotification types
 * @notExported
 */
export const handler = withXRay(async (event: SQSEvent): Promise<void> => {
  logDebug('event', event)
  for (const record of event.Records) {
    const notificationType = record.messageAttributes.notificationType?.stringValue as FileNotificationType
    if (!SUPPORTED_NOTIFICATION_TYPES.includes(notificationType)) {
      logInfo('Skipping unsupported notification type', notificationType)
      return
    }
    const userId = record.messageAttributes.userId.stringValue as string
    const deviceIds = await getUserDevicesByUserId(userId)
    if (deviceIds.length == 0) {
      logInfo('No devices registered for user', userId)
      return
    }
    logInfo('Sending messages to devices <=', deviceIds)
    for (const deviceId of deviceIds) {
      try {
        logInfo('Sending messages to deviceId <=', deviceId)
        const device = await getDevice(deviceId)
        const targetArn = device.endpointArn as string
        logInfo(`Sending ${notificationType} to targetArn`, targetArn)
        const publishParams = transformToAPNSNotification(record.body, targetArn) as PublishInput
        logDebug('publishSnsEvent <=', publishParams)
        const publishResponse = await publishSnsEvent(publishParams)
        logDebug('publishSnsEvent =>', publishResponse)
      } catch (error) {
        assertIsError(error)
        logError('publishSnsEvent error', error.message)
      }
    }
  }
})
