/**
 * PruneDevices Lambda
 *
 * Scheduled job to clean up inactive or invalid device registrations.
 * Removes devices with expired APNS tokens or inactive endpoints.
 *
 * Trigger: CloudWatch Schedule (daily)
 * Input: ScheduledEvent
 * Output: PruneDevicesResult with deletion counts
 */
import {deleteUserDevicesByDeviceId, getAllDevices} from '#entities/queries'
import {addMetadata, endSpan, startSpan} from '#lib/vendor/OpenTelemetry'
import type {Device} from '#types/domainModels'
import type {ApplePushNotificationResponse, PruneDevicesResult} from '#types/lambda'
import {deleteDevice} from '#lib/services/device/deviceService'
import {getOptionalEnv, getRequiredEnv} from '#lib/system/env'
import {Apns2Error, UnexpectedError} from '#lib/system/errors'
import {metrics, MetricUnit, withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapScheduledHandler} from '#lib/lambda/middleware/internal'
import {logDebug, logError, logInfo} from '#lib/system/logging'

// Re-export types for external consumers
export type { PruneDevicesResult } from '#types/lambda'

// Get all devices
async function getDevices(): Promise<Device[]> {
  const devices = await getAllDevices()
  logDebug('getDevices =>', {count: devices.length})
  return devices as Device[]
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
  // Track prune devices run
  metrics.addMetric('PruneDevicesRun', MetricUnit.Count, 1)

  const span = startSpan('prune-devices-cleanup')

  const result: PruneDevicesResult = {devicesChecked: 0, devicesPruned: 0, errors: []}

  const devices = await getDevices()
  result.devicesChecked = devices.length

  for (const device of devices) {
    const deviceId = device.deviceId
    logInfo('Verifying device', deviceId)
    if (await isDeviceDisabled(device.token)) {
      try {
        // Delete UserDevices junction records first (children before parent)
        await deleteUserDevicesByDeviceId(deviceId)

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

  // Track devices pruned
  metrics.addMetric('DevicesPruned', MetricUnit.Count, result.devicesPruned)
  addMetadata(span, 'devicesChecked', result.devicesChecked)
  addMetadata(span, 'devicesPruned', result.devicesPruned)
  addMetadata(span, 'errors', result.errors.length)
  endSpan(span)

  logInfo('PruneDevices completed', result)
  return result
}))
