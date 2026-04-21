/**
 * Device Prune Service
 *
 * Health-check and pruning utilities for APNS device tokens.
 * Used by the PruneDevices scheduled Lambda.
 */
import {getAllDevices} from '#entities/queries'
import {logDebug, logError, logInfo} from '@mantleframework/observability'
import type {Device} from '#types/domainModels'
import type {ApplePushNotificationResponse} from '#types/lambda'
import {getOptionalEnv, getRequiredEnv} from '@mantleframework/env'
import {UnexpectedError} from '@mantleframework/errors'
import type {Apns2Error} from '#errors/custom-errors'

/** Fetch all devices from the database */
export async function getDevices(): Promise<Device[]> {
  const devices = await getAllDevices()
  logDebug('getDevices =>', {count: devices.length})
  return devices as Device[]
}

/** Send a health-check background push to a device token via APNS */
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
    logDebug('apnProvider.send <=', healthCheckNotification as unknown as Record<string, unknown>)
    const result = await client.send(healthCheckNotification)
    logDebug('apnProvider.send =>', result as unknown as Record<string, unknown>)
    return {statusCode: 200}
  } catch (err) {
    logError('apnProvider.send =>', {error: err instanceof Error ? err.message : String(err)})
    if (err && typeof err === 'object' && 'reason' in err) {
      const apnsError = err as Apns2Error
      return {statusCode: Number(apnsError.statusCode), reason: apnsError.reason}
    } else {
      throw new UnexpectedError('Unexpected result from APNS')
    }
  }
}

/** Check if a device token is disabled (APNS returns 410) */
export async function isDeviceDisabled(token: string): Promise<boolean> {
  const apnsResponse = await dispatchHealthCheckNotificationToDeviceToken(token)
  return apnsResponse.statusCode === 410
}
