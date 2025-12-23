import type {SQSBatchResponse, SQSEvent, SQSRecord} from 'aws-lambda'
import {UserDevices} from '#entities/UserDevices'
import {Devices} from '#entities/Devices'
import {publishSnsEvent} from '#lib/vendor/AWS/SNS'
import type {PublishInput} from '#lib/vendor/AWS/SNS'
import type {Device} from '#types/domain-models'
import type {FileNotificationType} from '#types/notification-types'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {logDebug, logError, logInfo} from '#lib/system/logging'
import {providerFailureErrorMessage, UnexpectedError} from '#lib/system/errors'
import {transformToAPNSNotification} from '#lib/domain/notification/transformers'

const SUPPORTED_NOTIFICATION_TYPES: FileNotificationType[] = ['MetadataNotification', 'DownloadReadyNotification']

/**
 * Returns device IDs for a user
 * @param userId - The UUID of the user
 * @notExported
 */
async function getUserDevicesByUserId(userId: string): Promise<string[]> {
  logDebug('getUserDevicesByUserId <=', userId)
  const userResponse = await UserDevices.query.byUser({userId}).go()
  logDebug('getUserDevicesByUserId =>', userResponse)
  if (!userResponse || !userResponse.data) {
    return []
  }
  return userResponse.data.map((userDevice) => userDevice.deviceId)
}

/**
 * Retrieves a Device from DynamoDB (if it exists)
 * @param deviceId - The unique Device identifier
 * @notExported
 */
async function getDevice(deviceId: string): Promise<Device> {
  logDebug('getDevice <=', deviceId)
  const response = await Devices.get({deviceId}).go()
  logDebug('getDevice =>', response)
  if (response && response.data) {
    return response.data as Device
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
  const deviceIds = await getUserDevicesByUserId(userId)
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
