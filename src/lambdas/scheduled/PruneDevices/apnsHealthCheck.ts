/**
 * APNS Health Check
 *
 * Sends a background health-check push to a device token and classifies the APNS verdict
 * for PruneDevices.
 */
import {getOptionalEnv, getRequiredEnv} from '@j0nathan-ll0yd/env'
import {UnexpectedError} from '@j0nathan-ll0yd/errors'
import {logDebug, logError, logInfo, logWarn} from '@j0nathan-ll0yd/observability'
import type {Apns2Error} from '#errors/custom-errors'
import type {ApplePushNotificationResponse} from '#types/lambda'

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
    // A structured APNS rejection (has a `reason`) is an expected outcome of a health check — the
    // whole point of this job is to surface dead tokens. Log it at WARN, not ERROR, so it does not
    // trip alerting; the caller decides whether the reason is permanent (prune) or transient (skip).
    if (err && typeof err === 'object' && 'reason' in err) {
      const apnsError = err as Apns2Error
      logWarn('apnProvider.send => APNS rejection', {statusCode: apnsError.statusCode, reason: apnsError.reason})
      return {statusCode: Number(apnsError.statusCode), reason: apnsError.reason}
    }
    // No reason means an unexpected transport/library failure, not a token verdict — this is a real error.
    logError('apnProvider.send => unexpected failure', {error: err instanceof Error ? err.message : String(err)})
    throw new UnexpectedError('Unexpected result from APNS')
  }
}

/**
 * APNS `reason` values that indicate the token is permanently invalid and can never receive a push.
 * `Unregistered` (410) — app uninstalled. `BadDeviceToken` / `DeviceTokenNotForTopic` (400) — token
 * malformed or registered against a different environment/topic. All three warrant pruning; every
 * other reason (e.g. `TooManyRequests`, `InternalServerError`, `ServiceUnavailable`) is transient.
 * @see https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns
 */
const PERMANENT_APNS_REASONS = new Set(['Unregistered', 'BadDeviceToken', 'DeviceTokenNotForTopic'])

/**
 * Health-check a device token and decide whether it is permanently invalid (safe to prune).
 * Returns false for both healthy tokens and transient failures — a transient failure logs a warning
 * and leaves the device in place so it is re-checked on the next run rather than deleted in error.
 */
export async function isDeviceTokenPermanentlyInvalid(token: string): Promise<boolean> {
  const apnsResponse = await dispatchHealthCheckNotificationToDeviceToken(token)
  if (apnsResponse.statusCode === 200) {
    return false
  }
  if (apnsResponse.reason && PERMANENT_APNS_REASONS.has(apnsResponse.reason)) {
    return true
  }
  // Non-200 without a permanent reason: transient (rate limit, APNS outage). Keep the device, retry next run.
  logWarn('Transient APNS failure; leaving device in place', {statusCode: apnsResponse.statusCode, reason: apnsResponse.reason})
  return false
}
