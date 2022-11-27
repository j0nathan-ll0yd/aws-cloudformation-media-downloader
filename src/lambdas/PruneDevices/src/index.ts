import {ScheduledEvent, Context, APIGatewayProxyResult} from 'aws-lambda'
import {logDebug, logError, logInfo, response} from '../../../util/lambda-helpers'
import {scan} from '../../../lib/vendor/AWS/DynamoDB'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors'
import {ApplePushNotificationResponse, Device, DynamoDBUserDevice} from '../../../types/main'
import {getUsersByDeviceId} from '../../../util/dynamodb-helpers'
import {getApplePushNotificationServiceCert, getApplePushNotificationServiceKey} from '../../../util/secretsmanager-helpers'
import {deleteDevice, deleteUserDevice} from '../../../util/shared'
import * as apn from 'apn'
import {assertIsError} from '../../../util/transformers'

/**
 * Returns an array of filesIds that are ready to be downloaded
 * @notExported
 */
async function getDevices(): Promise<Device[]> {
  logDebug('getDevices <=')
  const scanResponse = await scan({TableName: process.env.DynamoDBTableDevices as string})
  logDebug('getDevices =>', scanResponse)
  if (!scanResponse || !scanResponse.Items) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return scanResponse.Items as Device[]
}

async function isDeviceDisabled(token: string): Promise<boolean> {
  const apnsResponse = await dispatchHealthCheckNotificationToDeviceToken(token)
  return apnsResponse.statusCode === 410
}

// TODO: Replace with node-apn
async function dispatchHealthCheckNotificationToDeviceToken(token: string): Promise<ApplePushNotificationResponse> {
  logInfo('dispatchHealthCheckNotificationToDeviceToken')
  const apnsKey = await getApplePushNotificationServiceKey()
  const apnsCert = await getApplePushNotificationServiceCert()
  const options = {
    key: apnsKey,
    cert: apnsCert,
    production: false
  }
  const apnProvider = new apn.Provider(options)
  const healthCheckNotification = new apn.Notification()
  healthCheckNotification.priority = 5
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  healthCheckNotification.pushType = 'background'
  healthCheckNotification.payload = {health: 'check'}
  healthCheckNotification.topic = 'lifegames.OfflineMediaDownloader'
  logDebug('apnProvider.send <=', healthCheckNotification)
  const result = await apnProvider.send(healthCheckNotification, token)
  logDebug('apnProvider.send =>', result)
  if (result && result.sent && result.sent.length > 0) {
    return {statusCode: 200}
  } else if (result && result.failed && result.failed.length > 0) {
    const failedResult = result.failed[0]
    /* eslint-disable-next-line  @typescript-eslint/no-non-null-assertion */
    const reason = failedResult.response!.reason
    return {statusCode: Number(failedResult.status), reason}
  } else {
    throw new UnexpectedError('Unexpected result from APNS')
  }
}

async function getUserIdsByDeviceId(deviceId: string): Promise<string[]> {
  const params = getUsersByDeviceId(process.env.DynamoDBTableUserDevices as string, deviceId)
  logDebug('getUserIdsByDeviceId <=', params)
  const response = await scan(params)
  logDebug('getUserIdsByDeviceId <=', response)
  if (!response || !response.Items) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  const userDevices = response.Items as DynamoDBUserDevice[]
  return userDevices.map((userDevice) => userDevice.userId)
}

/**
 * Removes Devices and related data if the device is no longer active.
 * Activity is determined by directly querying the APNS.
 * - If the device is disabled, remove the platform endpoint and device data
 * - If the device is associated with a user, remove it from UserDevices
 * @param event - An AWS ScheduledEvent; happening daily
 * @param context - An AWS Context object
 * @notExported
 */
export async function handler(event: ScheduledEvent, context: Context): Promise<APIGatewayProxyResult> {
  logInfo('event', event)
  const devices = await getDevices()
  for (const device of devices) {
    const deviceId = device.deviceId
    logInfo('Verifying device', deviceId)
    if (await isDeviceDisabled(device.token)) {
      try {
        // Unbelievably, all these methods are idempotent
        const userIds = await getUserIdsByDeviceId(deviceId)
        const values = await Promise.all([deleteDevice(device), userIds.map((userId) => deleteUserDevice(userId, deviceId))])
        logDebug('Promise.all', values)
      } catch (error) {
        assertIsError(error)
        logError(`Failed to properly remove device ${deviceId}`, error.message)
        // TODO: Trigger severe alarm with device details and requestId so it can be manually deleted later
      }
    }
  }
  return response(context, 200)
}
