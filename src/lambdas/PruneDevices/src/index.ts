import {ScheduledEvent} from 'aws-lambda'
import {Devices} from '../../../entities/Devices'
import {UserDevices} from '../../../entities/UserDevices'
import {logDebug, logError, logInfo} from '../../../util/lambda-helpers'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors'
import {ApplePushNotificationResponse, Device} from '../../../types/main'
import {deleteDevice} from '../../../util/shared'
import {assertIsError} from '../../../util/transformers'
import {ApnsClient, Notification, PushType, Priority} from 'apns2'
import {Apns2Error} from '../../../util/errors'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

/**
 * Returns an array of all devices
 * @notExported
 */
async function getDevices(): Promise<Device[]> {
  logDebug('getDevices <=')
  const scanResponse = await Devices.scan.go()
  logDebug('getDevices =>', scanResponse)
  if (!scanResponse || !scanResponse.data) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return scanResponse.data as Device[]
}

async function isDeviceDisabled(token: string): Promise<boolean> {
  const apnsResponse = await dispatchHealthCheckNotificationToDeviceToken(token)
  return apnsResponse.statusCode === 410
}

async function dispatchHealthCheckNotificationToDeviceToken(token: string): Promise<ApplePushNotificationResponse> {
  logInfo('dispatchHealthCheckNotificationToDeviceToken')
  const client = new ApnsClient({
    team: process.env.ApnsTeam,
    keyId: process.env.ApnsKeyId,
    signingKey: process.env.ApnsSigningKey,
    defaultTopic: process.env.ApnsDefaultTopic,
    host: 'api.sandbox.push.apple.com'
  })
  const healthCheckNotification = new Notification(token, {
    contentAvailable: true,
    type: PushType.background,
    priority: Priority.throttled,
    aps: {
      health: 'check'
    }
  })
  try {
    logDebug('apnProvider.send <=', healthCheckNotification)
    const result = await client.send(healthCheckNotification)
    logDebug('apnProvider.send =>', result)
    return {statusCode: 200}
  } catch (err) {
    logError('apnProvider.send =>', err as object)
    if (err && typeof err === 'object' && 'reason' in err) {
      const apnsError = err as Apns2Error
      return {statusCode: Number(apnsError.statusCode), reason: apnsError.reason}
    } else {
      throw new UnexpectedError('Unexpected result from APNS')
    }
  }
}

async function getUserIdsByDeviceId(deviceId: string): Promise<string[]> {
  logDebug('getUserIdsByDeviceId <=', deviceId)
  const response = await UserDevices.query.byDevice({deviceId}).go()
  logDebug('getUserIdsByDeviceId =>', response)
  if (!response || !response.data) {
    return []
  }
  return response.data.map((userDevice) => userDevice.userId)
}

/**
 * Removes Devices and related data if the device is no longer active.
 * Activity is determined by directly querying the APNS.
 * - If the device is disabled, remove the platform endpoint and device data
 * - If the device is associated with a user, remove it from UserDevices
 * {@label PRUNE_DEVICES_HANDLER}
 * @param event - An AWS ScheduledEvent; happening daily
 * @param context - An AWS Context object
 * @notExported
 */
export const handler = withXRay(async (event: ScheduledEvent): Promise<void> => {
  logInfo('event <=', event)
  const devices = await getDevices()
  for (const device of devices) {
    const deviceId = device.deviceId
    logInfo('Verifying device', deviceId)
    if (await isDeviceDisabled(device.token)) {
      try {
        // Unbelievably, all these methods are idempotent
        const userIds = await getUserIdsByDeviceId(deviceId)
        const deleteUserDevicesPromise =
          userIds.length > 0
            ? (async () => {
                const deleteKeys = userIds.map((userId) => ({userId, deviceId}))
                const {unprocessed} = await UserDevices.delete(deleteKeys).go({concurrency: 5})
                if (unprocessed.length > 0) {
                  logDebug('deleteUserDevices.unprocessed =>', unprocessed)
                }
              })()
            : Promise.resolve()
        const values = await Promise.all([deleteDevice(device), deleteUserDevicesPromise])
        logDebug('Promise.all', values)
      } catch (error) {
        assertIsError(error)
        logError(`Failed to properly remove device ${deviceId}`, error.message)
        // TODO: Trigger severe alarm with device details and requestId so it can be manually deleted later
      }
    }
  }
  logInfo('PruneDevices completed')
})
