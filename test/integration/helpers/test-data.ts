/**
 * Test Data Helpers
 *
 * Reusable factory functions for creating mock test data across integration tests.
 * Reduces inline JSON and provides consistent test data patterns.
 */

import {ScheduledEvent, SQSEvent} from 'aws-lambda'
import {FileStatus} from '#types/enums'
import {DynamoDBFile} from '#types/main'

/**
 * Creates a mock file object with sensible defaults
 * Provides ALL required ElectroDB fields for database operations
 * @param id - File ID (e.g., 'video-123')
 * @param status - File status from FileStatus enum
 * @param partial - Partial file data to override defaults
 */
export function createMockFile(id: string, status: FileStatus, partial?: Partial<DynamoDBFile>): Partial<DynamoDBFile> {
  const base: Partial<DynamoDBFile> = {
    fileId: id,
    status,
    title: `Test Video ${id}`,
    authorName: 'Test Channel',
    authorUser: 'testchannel',
    publishDate: new Date().toISOString(),
    description: `Test description for ${id}`,
    availableAt: Date.now(),
    contentType: 'video/mp4',
    size: 0,
    key: `${id}.mp4`
  }

  // Add Downloaded-specific fields
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
export function createMockFiles(count: number, status: FileStatus, idPrefix = 'video'): Partial<DynamoDBFile>[] {
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
 */
export function createMockDevice(deviceId: string, endpointArn?: string) {
  return {deviceId, endpointArn: endpointArn || `arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/${deviceId}`}
}

/**
 * Creates an SQS FileNotification event
 * @param userId - User ID to send notification to
 * @param fileId - File ID for the notification
 * @param partial - Partial file data to override defaults in message attributes
 */
export function createMockSQSFileNotificationEvent(
  userId: string,
  fileId: string,
  partial?: {title?: string; size?: number; url?: string}
): SQSEvent {
  const file = createMockFile(fileId, FileStatus.Downloaded, partial)

  return {
    Records: [{
      messageId: `test-message-${fileId}`,
      receiptHandle: `test-receipt-${fileId}`,
      body: 'FileNotification',
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: String(Date.now()),
        SenderId: 'test-sender',
        ApproximateFirstReceiveTimestamp: String(Date.now())
      },
      messageAttributes: {
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
 * Creates a CloudWatch Events / EventBridge scheduled event
 * @param eventId - Unique event ID
 * @param ruleName - Name of the EventBridge rule (default: 'FileCoordinatorSchedule')
 */
export function createMockScheduledEvent(eventId: string, ruleName = 'FileCoordinatorSchedule'): ScheduledEvent {
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
