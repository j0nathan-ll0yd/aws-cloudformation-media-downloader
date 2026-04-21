/**
 * PruneDevices Lambda
 *
 * Scheduled job to clean up inactive or invalid device registrations.
 * Removes devices with expired APNS tokens or inactive endpoints.
 *
 * Trigger: CloudWatch Schedule (daily)
 * Input: ScheduledEvent
 * Output: PruneDevicesResult with deletion counts
 *
 * @see {@link ../../../services/device/pruneService.ts} for APNS health-check logic
 */
import {deleteUserDevicesByDeviceId} from '#entities/queries'
import {defineLambda, defineScheduledHandler} from '@mantleframework/core'
import {addMetadata, endSpan, logError, logInfo, metrics, MetricUnit, startSpan} from '@mantleframework/observability'
import type {PruneDevicesResult} from '#types/lambda'
import {deleteDevice} from '#services/device/deviceService'
import {getDevices, isDeviceDisabled} from '#services/device/pruneService'

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

const scheduled = defineScheduledHandler({operationName: 'PruneDevices', schedule: {expression: 'rate(1 day)'}, timeout: 300})

export const handler = scheduled(async (): Promise<PruneDevicesResult> => {
  metrics.addMetric('PruneDevicesRun', MetricUnit.Count, 1)
  const span = startSpan('prune-devices-cleanup')
  const result: PruneDevicesResult = {devicesChecked: 0, devicesPruned: 0, errors: []}

  const devices = await getDevices()
  result.devicesChecked = devices.length

  for (const device of devices) {
    const deviceId = device.deviceId
    logInfo('Verifying device', {deviceId})
    if (await isDeviceDisabled(device.token)) {
      try {
        await deleteUserDevicesByDeviceId(deviceId)
        await deleteDevice(device)
        result.devicesPruned++
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
