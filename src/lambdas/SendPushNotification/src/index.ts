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
import type {SQSBatchResponse, SQSEvent, SQSRecord} from 'aws-lambda'
import {getDevice as getDeviceRecord, getUserDevicesByUserId} from '#entities/queries'
import {publishSnsEvent} from '#lib/vendor/AWS/SNS'
import type {PublishInput} from '#lib/vendor/AWS/SNS'
import type {Device} from '#types/domain-models'
import type {FileNotificationType} from '#types/notification-types'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {logDebug, logError, logInfo} from '#lib/system/logging'
import {providerFailureErrorMessage, UnexpectedError} from '#lib/system/errors'
import {transformToAPNSNotification} from '#lib/domain/notification/transformers'

const SUPPORTED_NOTIFICATION_TYPES: FileNotificationType[] = ['MetadataNotification', 'DownloadReadyNotification']

// Get device IDs for a user
async function getDeviceIdsForUser(userId: string): Promise<string[]> {
  logDebug('getDeviceIdsForUser <=', userId)
  const userDevices = await getUserDevicesByUserId(userId)
  logDebug('getDeviceIdsForUser =>', userDevices)
  return userDevices.map((ud) => ud.deviceId)
}

// Get device by ID
async function getDevice(deviceId: string): Promise<Device> {
  logDebug('getDevice <=', deviceId)
  const device = await getDeviceRecord(deviceId)
  logDebug('getDevice =>', device ?? 'null')
  if (device) {
    return device as Device
  } else {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
}

/**
 * Process a single SQS record - send push notifications to all user devices.
 * Throws on failure to enable batch item failure reporting.
 * @notExported
 */
async function processSQSRecord(record: SQSRecord): Promise<void> {
  const notificationType = record.messageAttributes.notificationType?.stringValue as FileNotificationType
  if (!SUPPORTED_NOTIFICATION_TYPES.includes(notificationType)) {
    logInfo('Skipping unsupported notification type', notificationType)
    return
  }
  const userId = record.messageAttributes.userId.stringValue as string
  const deviceIds = await getDeviceIdsForUser(userId)
  if (deviceIds.length == 0) {
    logInfo('No devices registered for user', userId)
    return
  }
  logInfo('Sending messages to devices <=', deviceIds)
  for (const deviceId of deviceIds) {
    logInfo('Sending messages to deviceId <=', deviceId)
    const device = await getDevice(deviceId)
    const targetArn = device.endpointArn as string
    logInfo(`Sending ${notificationType} to targetArn`, targetArn)
    const publishParams = transformToAPNSNotification(record.body, targetArn) as PublishInput
    logDebug('publishSnsEvent <=', publishParams)
    const publishResponse = await publishSnsEvent(publishParams)
    logDebug('publishSnsEvent =>', publishResponse)
  }
}

/**
 * Dispatches push notifications to all user devices.
 * Supports MetadataNotification and DownloadReadyNotification types.
 *
 * Returns SQSBatchResponse with failed message IDs for partial batch failure handling.
 * Failed messages will be retried by SQS and eventually sent to DLQ after maxReceiveCount.
 *
 * @notExported
 */
export const handler = withPowertools(async (event: SQSEvent): Promise<SQSBatchResponse> => {
  logInfo('event <=', {recordCount: event.Records.length})

  const batchItemFailures: {itemIdentifier: string}[] = []

  for (const record of event.Records) {
    try {
      await processSQSRecord(record)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logError('Failed to process record', {messageId: record.messageId, error: message})
      batchItemFailures.push({itemIdentifier: record.messageId})
    }
  }

  if (batchItemFailures.length > 0) {
    logInfo('Batch processing completed with failures', {
      total: event.Records.length,
      failed: batchItemFailures.length,
      succeeded: event.Records.length - batchItemFailures.length
    })
  }

  return {batchItemFailures}
})
