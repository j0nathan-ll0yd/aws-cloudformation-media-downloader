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
import {defineLambda, defineScheduledHandler} from '@j0nathan-ll0yd/core'
import {addMetadata, endSpan, logDebug, logError, logInfo, metrics, MetricUnit, startSpan} from '@j0nathan-ll0yd/observability'
import {deleteUserDevicesByDeviceId, getAllDevices} from '#entities/queries'
import {deleteDevice} from '#services/device/deviceService'
import type {Device} from '#types/domainModels'
import type {PruneDevicesResult} from '#types/lambda'
import {secondsAgo, TIME} from '#utils/time'
import {isDeviceTokenPermanentlyInvalid} from './apnsHealthCheck.js'

defineLambda({
  secrets: {
    APNS_SIGNING_KEY: 'apns.staging.signingKey',
    APNS_TEAM: 'apns.staging.team',
    APNS_KEY_ID: 'apns.staging.keyId',
    APNS_DEFAULT_TOPIC: 'apns.staging.defaultTopic'
  },
  staticEnvVars: {APNS_HOST: 'api.sandbox.push.apple.com'}
})

// Re-export types for external consumers
export type { PruneDevicesResult } from '#types/lambda'

/**
 * Reserved synthetic device seeded by `bin/test-registerDevice.sh` for remote smoke tests. Its token
 * is an all-zeros placeholder that APNS permanently rejects (400 BadDeviceToken), so it is excluded
 * from health checks — otherwise every run would prune it and the smoke-test fixture would vanish.
 */
const RESERVED_TEST_DEVICE_ID = '00000000-0000-0000-0000-000000000001'

/** Fetch all devices from the database */
async function getDevices(): Promise<Device[]> {
  const devices = await getAllDevices()
  logDebug('getDevices =>', {count: devices.length})
  return devices as Device[]
}

const scheduled = defineScheduledHandler({operationName: 'PruneDevices', schedule: {expression: 'rate(1 day)'}, timeout: 300})

export const handler = scheduled(async (): Promise<PruneDevicesResult> => {
  metrics.addMetric('PruneDevicesRun', MetricUnit.Count, 1)
  const span = startSpan('prune-devices-cleanup')
  const result: PruneDevicesResult = {devicesChecked: 0, devicesPruned: 0, errors: []}

  const devices = await getDevices()
  result.devicesChecked = devices.length

  const staleThreshold = secondsAgo(30 * TIME.DAY_SEC)

  for (const device of devices) {
    const deviceId = device.deviceId

    // The reserved smoke-test device carries an intentionally-invalid token; never health-check or prune it.
    if (deviceId === RESERVED_TEST_DEVICE_ID) {
      logDebug('Skipping reserved smoke-test device', {deviceId})
      continue
    }

    logInfo('Verifying device', {deviceId})

    let shouldPrune = false
    let pruneReason = ''

    if (await isDeviceTokenPermanentlyInvalid(device.token)) {
      shouldPrune = true
      pruneReason = 'APNS token permanently invalid'
    } else if (device.lastSeenAt && device.lastSeenAt < staleThreshold) {
      shouldPrune = true
      pruneReason = 'lastSeenAt stale'
      logInfo('Device stale by lastSeenAt', {deviceId, lastSeenAt: device.lastSeenAt.toISOString()})
    }

    if (shouldPrune) {
      try {
        await deleteUserDevicesByDeviceId(deviceId)
        await deleteDevice(device)
        result.devicesPruned++
        logInfo('Pruned device', {deviceId, reason: pruneReason})
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const errorMessage = `Failed to properly remove device ${deviceId}: ${message}`
        logError(errorMessage, {deviceId})
        result.errors.push(errorMessage)
      }
    }
  }

  metrics.addMetric('DevicesPruned', MetricUnit.Count, result.devicesPruned)
  addMetadata(span, 'devicesChecked', result.devicesChecked)
  addMetadata(span, 'devicesPruned', result.devicesPruned)
  addMetadata(span, 'errors', result.errors.length)
  endSpan(span)

  logInfo('PruneDevices completed', result as unknown as Record<string, unknown>)
  return result
})
