/**
 * SendPushNotification Lambda
 *
 * Sends APNS push notifications to user devices.
 * Processes notification messages from SQS queue.
 *
 * Trigger: SQS Queue (from S3ObjectCreated)
 * Input: SQSEvent with FileNotificationType records
 * Output: SQSBatchResponse with item failures for retry
 */
import {getDevice as getDeviceRecord, getUserDevicesByUserId} from '#entities/queries'
import {publish} from '@mantleframework/aws'
import {defineSqsHandler} from '@mantleframework/core'
import {addAnnotation, addMetadata, endSpan, logDebug, logError, logInfo, metrics, MetricUnit, startSpan} from '@mantleframework/observability'
import type {Device} from '#types/domainModels'
import type {DeviceNotificationResult, FileNotificationType} from '#types/notificationTypes'
import {pushNotificationAttributesSchema} from '#types/schemas'
import {validateSchema} from '@mantleframework/validation'
import {UnexpectedError} from '@mantleframework/errors'
import {providerFailureErrorMessage} from '#errors/custom-errors'
import {transformToAPNSAlertNotification, transformToAPNSNotification} from '#services/notification/transformers'
import {cleanupDisabledEndpoints} from '#services/notification/endpointCleanup'

// Validation now handled by pushNotificationAttributesSchema in processSQSRecord

// Get device IDs for a user
async function getDeviceIdsForUser(userId: string): Promise<string[]> {
  logDebug('getDeviceIdsForUser <=', {userId})
  const userDevices = await getUserDevicesByUserId(userId)
  logDebug('getDeviceIdsForUser =>', {count: userDevices.length})
  return userDevices.map((ud) => ud.deviceId)
}

// Get device by ID
async function getDevice(deviceId: string): Promise<Device> {
  logDebug('getDevice <=', {deviceId})
  const device = await getDeviceRecord(deviceId)
  logDebug('getDevice =>', (device as unknown as Record<string, unknown>) ?? {found: false})
  if (device) {
    return device as Device
  } else {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
}

/**
 * Send notification to a single device with error handling
 * Routes to alert or background notification based on type
 * Returns result object instead of throwing
 */
async function sendNotificationToDevice(device: Device, messageBody: string, notificationType: FileNotificationType): Promise<DeviceNotificationResult> {
  const targetArn = device.endpointArn
  if (!targetArn) {
    return {deviceId: device.deviceId, success: false, error: 'No endpoint ARN configured'}
  }
  try {
    logInfo(`Sending ${notificationType} to device`, {deviceId: device.deviceId})

    // Route to alert notification for FailureNotification, background for others
    const publishParams = notificationType === 'FailureNotification'
      ? transformToAPNSAlertNotification(messageBody, targetArn)
      : transformToAPNSNotification(messageBody, targetArn)

    logDebug('publish <=', publishParams as unknown as Record<string, unknown>)
    const publishResponse = await publish(publishParams)
    logDebug('publish =>', publishResponse as unknown as Record<string, unknown>)

    return {deviceId: device.deviceId, success: true}
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Detect disabled endpoints - these occur when APNS token is invalid
    const isEndpointDisabled = message.includes('EndpointDisabled') || message.includes('endpoint is disabled')

    return {deviceId: device.deviceId, success: false, error: message, endpointDisabled: isEndpointDisabled}
  }
}

const sqs = defineSqsHandler<string>({operationName: 'SendPushNotification', parseBody: false, queue: 'send-push-notification'})

export const handler = sqs(async (record, _metadata) => {
  // Validate message attributes using Zod schema
  const rawAttributes = {notificationType: record.messageAttributes.notificationType?.stringValue, userId: record.messageAttributes.userId?.stringValue}
  const validationErrors = validateSchema(pushNotificationAttributesSchema, rawAttributes)
  if (validationErrors) {
    logError('Invalid SQS message attributes - discarding', {messageId: record.messageId, errors: validationErrors.errors})
    return
  }

  const validatedAttrs = pushNotificationAttributesSchema.parse(rawAttributes)
  const notificationType = validatedAttrs.notificationType as FileNotificationType
  const userId = validatedAttrs.userId

  const span = startSpan('send-push')
  addAnnotation(span, 'userId', userId)
  addAnnotation(span, 'notificationType', notificationType)

  try {
    const deviceIds = await getDeviceIdsForUser(userId)
    addMetadata(span, 'deviceCount', deviceIds.length)

    if (deviceIds.length == 0) {
      logInfo('No devices registered for user', {userId})
      endSpan(span)
      return
    }

    logInfo('Sending notifications to devices', {userId, deviceCount: deviceIds.length})

    // Process all devices in parallel with individual error handling
    const results = await Promise.allSettled(deviceIds.map(async (deviceId) => {
      const device = await getDevice(deviceId)
      return sendNotificationToDevice(device, record.body, notificationType)
    }))

    // Collect results
    const deviceResults: DeviceNotificationResult[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      }
      return {deviceId: deviceIds[index]!, success: false as const, error: result.reason instanceof Error ? result.reason.message : String(result.reason)}
    })

    const succeeded = deviceResults.filter((r) => r.success)
    const failed = deviceResults.filter((r) => !r.success)
    const disabledEndpoints = deviceResults.filter((r) => r.endpointDisabled)

    // Emit metrics for observability
    metrics.addMetric('PushNotificationsSent', MetricUnit.Count, succeeded.length)
    addMetadata(span, 'notificationsSent', succeeded.length)
    addMetadata(span, 'notificationsFailed', failed.length)
    addMetadata(span, 'disabledEndpoints', disabledEndpoints.length)

    if (failed.length > 0) {
      metrics.addMetric('PushNotificationsFailed', MetricUnit.Count, failed.length)
    }
    if (disabledEndpoints.length > 0) {
      metrics.addMetric('DisabledEndpointsDetected', MetricUnit.Count, disabledEndpoints.length)
    }

    // Log results
    if (failed.length > 0) {
      logInfo('Push notification results', {
        userId,
        total: deviceIds.length,
        succeeded: succeeded.length,
        failed: failed.length,
        disabledEndpoints: disabledEndpoints.length
      })

      failed.forEach((r) => {
        logError('Device notification failed', {deviceId: r.deviceId, error: r.error, endpointDisabled: r.endpointDisabled})
      })
    }

    // Clean up disabled endpoints (best-effort, don't fail the message)
    if (disabledEndpoints.length > 0) {
      logInfo('Cleaning up disabled endpoints', {userId, deviceIds: disabledEndpoints.map((r) => r.deviceId)})

      // Run cleanup asynchronously (fire-and-forget to not block message processing)
      // Errors are logged within cleanupDisabledEndpoints, won't affect message success
      cleanupDisabledEndpoints(disabledEndpoints.map((r) => r.deviceId)).catch((err: unknown) => {
        logError('Async endpoint cleanup failed', {error: err instanceof Error ? err.message : String(err)})
      })
    }

    // Only fail the SQS message if ALL devices failed
    // Partial success = message processed successfully (don't retry for succeeded devices)
    if (succeeded.length === 0 && failed.length > 0) {
      const error = new Error(`All ${failed.length} device notifications failed`)
      endSpan(span, error)
      throw error
    }

    endSpan(span)
  } catch (error) {
    endSpan(span, error as Error)
    throw error
  }
})
