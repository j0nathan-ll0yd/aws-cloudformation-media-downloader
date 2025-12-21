import {ApnsClient, Notification, Priority, PushType} from 'apns2'

import {Devices} from '#entities/Devices'
import {UserDevices} from '#entities/UserDevices'

import type {Device} from '#types/domain-models'
import type {ApplePushNotificationResponse, PruneDevicesResult} from '#types/lambda-payloads'

import {deleteDevice} from '#util/device-helpers'
import {getOptionalEnv, getRequiredEnv} from '#util/env-validation'
import {Apns2Error, UnexpectedError} from '#util/errors'
import {withPowertools, wrapScheduledHandler} from '#util/lambda-helpers'
import {logDebug, logError, logInfo} from '#util/logging'
import {scanAllPages} from '#util/pagination'
import {retryUnprocessedDelete} from '#util/retry'

// Re-export types for external consumers
export type { PruneDevicesResult } from '#types/lambda-payloads'

/**
 * Returns an array of all devices using paginated scan
 * @notExported
 */
async function getDevices(): Promise<Device[]> {
  const devices = await scanAllPages<Device>(async (cursor) => {
    const scanResponse = await Devices.scan.go({cursor})
    if (!scanResponse) {
      throw new UnexpectedError('Device scan failed')
    }
    return {data: (scanResponse.data || []) as Device[], cursor: scanResponse.cursor ?? null}
  })
  logDebug('getDevices =>', {count: devices.length})
  return devices
}

async function isDeviceDisabled(token: string): Promise<boolean> {
  const apnsResponse = await dispatchHealthCheckNotificationToDeviceToken(token)
  return apnsResponse.statusCode === 410
}

async function dispatchHealthCheckNotificationToDeviceToken(token: string): Promise<ApplePushNotificationResponse> {
  logInfo('dispatchHealthCheckNotificationToDeviceToken')
  const client = new ApnsClient({
    team: getRequiredEnv('ApnsTeam'),
    keyId: getRequiredEnv('ApnsKeyId'),
    signingKey: getRequiredEnv('ApnsSigningKey'),
    defaultTopic: getRequiredEnv('ApnsDefaultTopic'),
    host: getOptionalEnv('APNS_HOST', 'api.sandbox.push.apple.com')
  })
  const healthCheckNotification = new Notification(token, {
    contentAvailable: true,
    type: PushType.background,
    priority: Priority.throttled,
    aps: {health: 'check'}
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
 * @returns PruneDevicesResult with counts of devices checked, pruned, and any errors
 * @notExported
 */
export const handler = withPowertools(wrapScheduledHandler(async (): Promise<PruneDevicesResult> => {
  const result: PruneDevicesResult = {devicesChecked: 0, devicesPruned: 0, errors: []}

  const devices = await getDevices()
  result.devicesChecked = devices.length

  for (const device of devices) {
    const deviceId = device.deviceId
    logInfo('Verifying device', deviceId)
    if (await isDeviceDisabled(device.token)) {
      try {
        // Unbelievably, all these methods are idempotent
        const userIds = await getUserIdsByDeviceId(deviceId)
        const deleteUserDevicesPromise = userIds.length > 0
          ? (async () => {
            const deleteKeys = userIds.map((userId) => ({userId, deviceId}))
            const {unprocessed} = await retryUnprocessedDelete(() => UserDevices.delete(deleteKeys).go({concurrency: 5}))
            if (unprocessed.length > 0) {
              logError('deleteUserDevices: failed to delete all items after retries', unprocessed)
            }
          })()
          : Promise.resolve()

        // Cascade order: Delete children (UserDevices) first, then parent (Device)
        await deleteUserDevicesPromise
        await deleteDevice(device)

        result.devicesPruned++
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const errorMessage = `Failed to properly remove device ${deviceId}: ${message}`
        logError(errorMessage)
        result.errors.push(errorMessage)
        // TODO: Trigger severe alarm with device details and requestId so it can be manually deleted later
      }
    }
  }

  logInfo('PruneDevices completed', result)
  return result
}))
