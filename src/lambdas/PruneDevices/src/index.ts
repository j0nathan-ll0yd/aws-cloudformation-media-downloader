import {Devices} from '#entities/Devices'
import {UserDevices} from '#entities/UserDevices'
import type {Device} from '#types/domain-models'
import type {ApplePushNotificationResponse, PruneDevicesResult} from '#types/lambda'
import {deleteDevice} from '#lib/domain/device/device-service'
import {getOptionalEnv, getRequiredEnv} from '#lib/system/env'
import {Apns2Error, UnexpectedError} from '#lib/system/errors'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapScheduledHandler} from '#lib/lambda/middleware/internal'
import {logDebug, logError, logInfo} from '#lib/system/logging'
import {scanAllPages} from '#lib/data/pagination'
import {retryUnprocessedDelete} from '#lib/system/retry'

// Re-export types for external consumers
export type { PruneDevicesResult } from '#types/lambda'

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
  // Dynamic import for ESM compatibility - apns2 is CJS-only
  const {ApnsClient, Notification, Priority, PushType} = await import('apns2')
  const client = new ApnsClient({
    team: getRequiredEnv('APNS_TEAM'),
    keyId: getRequiredEnv('APNS_KEY_ID'),
    signingKey: getRequiredEnv('APNS_SIGNING_KEY'),
    defaultTopic: getRequiredEnv('APNS_DEFAULT_TOPIC'),
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

        // Delete UserDevices junction records first (children before parent)
        if (userIds.length > 0) {
          const deleteKeys = userIds.map((userId) => ({userId, deviceId}))
          const {unprocessed} = await retryUnprocessedDelete(() => UserDevices.delete(deleteKeys).go({concurrency: 5}))
          if (unprocessed.length > 0) {
            logError('deleteUserDevices: failed to delete all items after retries', unprocessed)
          }
        }

        // Then delete the Device itself
        await deleteDevice(device)

        result.devicesPruned++
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const errorMessage = `Failed to properly remove device ${deviceId}: ${message}`
        logError(errorMessage)
        result.errors.push(errorMessage)
        // Severe alarm needed: device orphaned in DynamoDB after cascade delete failure
        // Should trigger manual intervention to delete device record with ID and requestId
        // Tracking: Monitor CloudWatch for orphaned device cleanup patterns
      }
    }
  }

  logInfo('PruneDevices completed', result)
  return result
}), {skipMetrics: true})
