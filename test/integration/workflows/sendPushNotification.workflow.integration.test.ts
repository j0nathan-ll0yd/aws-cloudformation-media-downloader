/**
 * SendPushNotification Workflow Integration Tests
 *
 * Tests the push notification workflow against LocalStack:
 * 1. Receive SQS FileNotification event
 * 2. Query DynamoDB UserDevices table for user's devices
 * 3. Query DynamoDB Devices table for each device's endpoint ARN
 * 4. Fan-out: Publish SNS notification to each device endpoint
 * 5. Handle errors gracefully (invalid devices, missing endpoints)
 *
 * This tests YOUR orchestration logic, not AWS SDK behavior.
 */

// Test configuration
const TEST_USER_DEVICES_TABLE = 'test-user-devices-push'
const TEST_DEVICES_TABLE = 'test-devices-push'

// Set environment variables for Lambda
process.env.DynamoDBTableUserDevices = TEST_USER_DEVICES_TABLE
process.env.DynamoDBTableDevices = TEST_DEVICES_TABLE
process.env.USE_LOCALSTACK = 'true'

import {describe, test, expect, beforeAll, afterAll, beforeEach, jest} from '@jest/globals'
import {SQSEvent} from 'aws-lambda'

// Test helpers
import {createFilesTable, deleteFilesTable} from '../helpers/dynamodb-helpers'

import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const snsModulePath = resolve(__dirname, '../../../src/lib/vendor/AWS/SNS')
const dynamodbModulePath = resolve(__dirname, '../../../src/lib/vendor/AWS/DynamoDB')

const publishSnsEventMock = jest.fn<() => Promise<{MessageId: string}>>()
jest.unstable_mockModule(snsModulePath, () => ({
  publishSnsEvent: publishSnsEventMock,
  publish: publishSnsEventMock
}))

const queryMock = jest.fn<() => Promise<{Items?: unknown[]}>>()
jest.unstable_mockModule(dynamodbModulePath, () => ({
  query: queryMock,
  updateItem: jest.fn(),
  scan: jest.fn()
}))

const {handler} = await import('../../../src/lambdas/SendPushNotification/src/index')

type QueryCallArgs = [{TableName: string}]
type PublishCallArgs = [{TargetArn: string}]

function createFileNotificationEvent(userId: string, fileId: string, title?: string): SQSEvent {
  return {
    Records: [
      {
        messageId: `test-message-${fileId}`,
        receiptHandle: `test-receipt-${fileId}`,
        body: 'FileNotification',
        attributes: {
          ApproximateReceiveCount: '1',
          SentTimestamp: '1234567890',
          SenderId: 'test-sender',
          ApproximateFirstReceiveTimestamp: '1234567890'
        },
        messageAttributes: {
          userId: {stringValue: userId, dataType: 'String'},
          fileId: {stringValue: fileId, dataType: 'String'},
          key: {stringValue: `${fileId}.mp4`, dataType: 'String'},
          publishDate: {stringValue: new Date().toISOString(), dataType: 'String'},
          size: {stringValue: '5242880', dataType: 'String'},
          url: {stringValue: `https://example.com/${fileId}.mp4`, dataType: 'String'},
          title: {stringValue: title || 'Test Video', dataType: 'String'}
        },
        md5OfBody: 'test-md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:test-queue',
        awsRegion: 'us-west-2'
      }
    ]
  }
}

describe('SendPushNotification Workflow Integration Tests', () => {
  beforeAll(async () => {
    // Create LocalStack infrastructure (if needed)
    await createFilesTable()

    // Wait for tables to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000))
  })

  afterAll(async () => {
    // Clean up LocalStack infrastructure
    await deleteFilesTable()
  })

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks()

    // Reset mock implementations
    publishSnsEventMock.mockResolvedValue({MessageId: 'test-sns-message-id'})
  })

  test('should query DynamoDB and publish SNS notification for single user with single device', async () => {
    // Arrange: Mock DynamoDB responses
    // First query: getUserDevicesByUserId returns device IDs
    queryMock.mockResolvedValueOnce({
      Items: [
        {
          userId: 'user-123',
          devices: new Set(['device-abc'])
        }
      ]
    })

    queryMock.mockResolvedValueOnce({
      Items: [
        {
          deviceId: 'device-abc',
          endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/test-endpoint'
        }
      ]
    })

    const event = createFileNotificationEvent('user-123', 'video-123')

    await handler(event)

    expect(queryMock).toHaveBeenCalledTimes(2)

    const userDevicesQuery = (queryMock.mock.calls as unknown as QueryCallArgs[])[0][0]
    expect(userDevicesQuery.TableName).toBe(TEST_USER_DEVICES_TABLE)

    const devicesQuery = (queryMock.mock.calls as unknown as QueryCallArgs[])[1][0]
    expect(devicesQuery.TableName).toBe(TEST_DEVICES_TABLE)

    expect(publishSnsEventMock).toHaveBeenCalledTimes(1)

    const publishParams = (publishSnsEventMock.mock.calls as unknown as PublishCallArgs[])[0][0]
    expect(publishParams.TargetArn).toBe('arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/test-endpoint')
  })

  test('should fan-out to multiple devices when user has multiple registered devices', async () => {
    // Arrange: Mock DynamoDB responses
    // First query: getUserDevicesByUserId returns multiple device IDs
    queryMock.mockResolvedValueOnce({
      Items: [
        {
          userId: 'user-456',
          devices: new Set(['device-1', 'device-2', 'device-3'])
        }
      ]
    })

    queryMock.mockResolvedValueOnce({
      Items: [{deviceId: 'device-1', endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/endpoint-1'}]
    })

    queryMock.mockResolvedValueOnce({
      Items: [{deviceId: 'device-2', endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/endpoint-2'}]
    })

    queryMock.mockResolvedValueOnce({
      Items: [{deviceId: 'device-3', endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/endpoint-3'}]
    })

    const event = createFileNotificationEvent('user-456', 'video-456', 'Multi-Device Video')

    await handler(event)

    // Assert: DynamoDB queried 4 times (1 UserDevices + 3 Devices)
    expect(queryMock).toHaveBeenCalledTimes(4)

    // Assert: SNS publish called 3 times (one per device)
    expect(publishSnsEventMock).toHaveBeenCalledTimes(3)

    const targetArns = (publishSnsEventMock.mock.calls as unknown as PublishCallArgs[]).map((call) => call[0].TargetArn)
    expect(targetArns).toEqual([
      'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/endpoint-1',
      'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/endpoint-2',
      'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/endpoint-3'
    ])
  })

  test('should return early when user has no registered devices', async () => {
    // Arrange: Mock DynamoDB to return empty devices
    queryMock.mockResolvedValueOnce({
      Items: []
    })

    const event = createFileNotificationEvent('user-no-devices', 'video-789')

    await handler(event)

    // Assert: Only one DynamoDB query (UserDevices)
    expect(queryMock).toHaveBeenCalledTimes(1)

    // Assert: No SNS publish (no devices to notify)
    expect(publishSnsEventMock).not.toHaveBeenCalled()
  })

  test('should handle invalid device gracefully and continue to next device', async () => {
    // Arrange: Mock DynamoDB responses
    queryMock.mockResolvedValueOnce({
      Items: [
        {
          userId: 'user-789',
          devices: new Set(['device-good', 'device-bad'])
        }
      ]
    })

    queryMock.mockResolvedValueOnce({
      Items: [{deviceId: 'device-good', endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/good-endpoint'}]
    })

    // Second device query fails (device not found)
    queryMock.mockResolvedValueOnce({
      Items: []
    })

    const event = createFileNotificationEvent('user-789', 'video-error')

    await expect(handler(event)).resolves.not.toThrow()

    expect(publishSnsEventMock).toHaveBeenCalledTimes(1)
    expect((publishSnsEventMock.mock.calls as unknown as PublishCallArgs[])[0][0].TargetArn).toBe('arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/good-endpoint')
  })

  test('should process multiple SQS records in same batch', async () => {
    // Arrange: Mock DynamoDB responses for two different users
    queryMock.mockResolvedValueOnce({
      Items: [{userId: 'user-1', devices: new Set(['device-user1'])}]
    })
    queryMock.mockResolvedValueOnce({
      Items: [{deviceId: 'device-user1', endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/user1-endpoint'}]
    })

    queryMock.mockResolvedValueOnce({
      Items: [{userId: 'user-2', devices: new Set(['device-user2'])}]
    })
    queryMock.mockResolvedValueOnce({
      Items: [{deviceId: 'device-user2', endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/user2-endpoint'}]
    })

    const event1 = createFileNotificationEvent('user-1', 'video-batch-1')
    const event2 = createFileNotificationEvent('user-2', 'video-batch-2')
    const batchEvent: SQSEvent = {
      Records: [...event1.Records, ...event2.Records]
    }

    await handler(batchEvent)

    // Assert: DynamoDB queried 4 times (2 users × 2 queries each)
    expect(queryMock).toHaveBeenCalledTimes(4)

    // Assert: SNS published 2 times (one per user)
    expect(publishSnsEventMock).toHaveBeenCalledTimes(2)
  })

  test('should skip non-FileNotification messages', async () => {
    // Arrange: SQS event with different message type
    const event: SQSEvent = {
      Records: [
        {
          messageId: 'test-message-6',
          receiptHandle: 'test-receipt-6',
          body: 'OtherNotificationType',
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1234567890',
            SenderId: 'test-sender',
            ApproximateFirstReceiveTimestamp: '1234567890'
          },
          messageAttributes: {},
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:test-queue',
          awsRegion: 'us-west-2'
        }
      ]
    }

    // Act: Invoke handler
    await handler(event)

    // Assert: No DynamoDB queries
    expect(queryMock).not.toHaveBeenCalled()

    // Assert: No SNS publish
    expect(publishSnsEventMock).not.toHaveBeenCalled()
  })
})
