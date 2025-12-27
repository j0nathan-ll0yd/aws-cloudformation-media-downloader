/**
 * Test Data Helpers
 *
 * Reusable factory functions for creating mock test data across integration tests.
 * Reduces inline JSON and provides consistent test data patterns.
 */

import type {ScheduledEvent, SQSEvent} from 'aws-lambda'
import {FileStatus} from '#types/enums'
import type {Device, File, User} from '#types/domain-models'

/**
 * Creates a mock file object with sensible defaults
 * Provides ALL required ElectroDB fields for database operations
 * @param id - File ID (e.g., 'video-123')
 * @param status - File status from FileStatus enum
 * @param partial - Partial file data to override defaults
 */
export function createMockFile(id: string, status: FileStatus, partial?: Partial<File>): Partial<File> {
  const base: Partial<File> = {
    fileId: id,
    status,
    title: `Test Video ${id}`,
    authorName: 'Test Channel',
    authorUser: 'testchannel',
    publishDate: new Date().toISOString(),
    description: `Test description for ${id}`,
    contentType: 'video/mp4',
    size: 0,
    key: `${id}.mp4`
  }

  // Add Downloaded-specific fields (downloaded files)
  if (status === FileStatus.Downloaded) {
    base.size = 5242880
    base.url = `https://example.com/${id}.mp4`
  }

  return {...base, ...partial}
}

/**
 * Creates an array of mock files for batch testing
 * @param count - Number of files to create
 * @param status - Status for all files
 * @param idPrefix - Prefix for file IDs (default: 'video')
 */
export function createMockFiles(count: number, status: FileStatus, idPrefix = 'video'): Partial<File>[] {
  return Array.from({length: count}, (_, i) => createMockFile(`${idPrefix}-${i}`, status))
}

/**
 * Creates a mock UserFile record (user-file association)
 * @param userId - User UUID
 * @param fileId - File ID
 */
export function createMockUserFile(userId: string, fileId: string) {
  return {userId, fileId}
}

/**
 * Creates a mock UserDevice record (user-device association)
 * @param userId - User UUID
 * @param deviceId - Device UUID
 */
export function createMockUserDevice(userId: string, deviceId: string) {
  return {userId, deviceId}
}

/**
 * Creates a mock Device record with endpoint ARN
 * @param deviceId - Device UUID
 * @param endpointArn - SNS endpoint ARN (optional, auto-generated if not provided)
 * @param partial
 */
export function createMockDevice(partial?: Partial<Device>): Partial<Device> {
  const deviceId = partial?.deviceId || `device-${Math.random().toString(36).substring(7)}`
  return {
    deviceId,
    name: partial?.name || 'Test iPhone',
    token: partial?.token || `token-${deviceId}`,
    systemVersion: partial?.systemVersion || '17.0',
    systemName: partial?.systemName || 'iOS',
    endpointArn: partial?.endpointArn || `arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/${deviceId}`,
    ...partial
  }
}

/**
 * Creates a mock User record with sensible defaults
 * @param partial - Partial user data to override defaults
 */
export function createMockUser(partial?: Partial<User> & {appleDeviceId?: string; userId?: string}): Partial<User> & {appleDeviceId?: string} {
  // Support both 'id' (domain type) and 'userId' (legacy tests) for backwards compatibility
  const id = partial?.id || partial?.userId || `user-${Math.random().toString(36).substring(7)}`
  return {
    id,
    email: partial?.email || `${id}@example.com`,
    emailVerified: partial?.emailVerified ?? true,
    firstName: partial?.firstName || 'Test',
    lastName: partial?.lastName || 'User',
    appleDeviceId: partial?.appleDeviceId,
    ...partial
  }
}

/**
 * Creates an SQS FileNotification event
 * @param userId - User ID to send notification to
 * @param fileId - File ID for the notification
 * @param partial - Partial file data to override defaults in message attributes
 * @param partial.title
 * @param partial.size
 * @param partial.url
 * @param notificationType - Notification type (default: 'DownloadReadyNotification')
 */
export function createMockSQSFileNotificationEvent(
  userId: string,
  fileId: string,
  partial?: {title?: string; size?: number; url?: string},
  notificationType = 'DownloadReadyNotification'
): SQSEvent {
  const file = createMockFile(fileId, FileStatus.Downloaded, partial)

  // Body must be JSON matching what createDownloadReadyNotification produces
  // SendPushNotification parses this with JSON.parse in transformToAPNSNotification
  const messageBody = JSON.stringify({
    file: {fileId, key: file.key || `${fileId}.mp4`, size: file.size || 5242880, url: file.url || `https://example.com/${fileId}.mp4`},
    notificationType
  })

  return {
    Records: [{
      messageId: `test-message-${fileId}`,
      receiptHandle: `test-receipt-${fileId}`,
      body: messageBody,
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: String(Date.now()),
        SenderId: 'test-sender',
        ApproximateFirstReceiveTimestamp: String(Date.now())
      },
      messageAttributes: {
        notificationType: {stringValue: notificationType, dataType: 'String'},
        userId: {stringValue: userId, dataType: 'String'},
        fileId: {stringValue: fileId, dataType: 'String'},
        key: {stringValue: file.key || `${fileId}.mp4`, dataType: 'String'},
        publishDate: {stringValue: file.publishDate || new Date().toISOString(), dataType: 'String'},
        size: {stringValue: String(file.size || 5242880), dataType: 'String'},
        url: {stringValue: file.url || `https://example.com/${fileId}.mp4`, dataType: 'String'},
        title: {stringValue: file.title || 'Test Video', dataType: 'String'}
      },
      md5OfBody: 'test-md5',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:test-queue',
      awsRegion: 'us-west-2'
    }]
  }
}

/**
 * Creates an SQS event for the DownloadQueue (StartFileUpload consumer)
 * @param fileId - Video file ID
 * @param options - Optional overrides for message fields
 * @param options.messageId
 * @param options.sourceUrl
 * @param options.correlationId
 * @param options.userId
 * @param options.attempt
 */
export function createMockDownloadQueueEvent(
  fileId: string,
  options?: {messageId?: string; sourceUrl?: string; correlationId?: string; userId?: string; attempt?: number}
): SQSEvent {
  const messageId = options?.messageId ?? `msg-${fileId}`
  const sourceUrl = options?.sourceUrl ?? `https://www.youtube.com/watch?v=${fileId}`
  const correlationId = options?.correlationId ?? `corr-${fileId}`
  const userId = options?.userId ?? 'test-user'
  const attempt = options?.attempt ?? 1

  return {
    Records: [{
      messageId,
      receiptHandle: `receipt-${messageId}`,
      body: JSON.stringify({fileId, sourceUrl, correlationId, userId, attempt}),
      attributes: {
        ApproximateReceiveCount: String(attempt),
        SentTimestamp: String(Date.now()),
        SenderId: 'AIDAIT2UOQQY3AUEKVGXU',
        ApproximateFirstReceiveTimestamp: String(Date.now())
      },
      messageAttributes: {},
      md5OfBody: 'test-md5',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:DownloadQueue',
      awsRegion: 'us-west-2'
    }]
  }
}

/**
 * Creates a CloudWatch Events / EventBridge scheduled event
 * @param eventId - Unique event ID
 * @param ruleName - Name of the EventBridge rule (default: 'ScheduledEvent')
 */
export function createMockScheduledEvent(eventId: string, ruleName = 'ScheduledEvent'): ScheduledEvent {
  return {
    id: eventId,
    version: '0',
    account: '123456789012',
    'detail-type': 'Scheduled Event',
    source: 'aws.events',
    time: new Date().toISOString(),
    region: 'us-west-2',
    resources: [`arn:aws:events:us-west-2:123456789012:rule/${ruleName}`],
    detail: {}
  }
}
