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
const TEST_TABLE = 'test-push-notification'

// Set environment variables for Lambda
process.env.DYNAMODB_TABLE_NAME = TEST_TABLE
process.env.USE_LOCALSTACK = 'true'

import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals'
import type {SQSEvent} from 'aws-lambda'

// Test helpers
import {createFilesTable, deleteFilesTable} from '../helpers/postgres-helpers'
import {createEntityMock} from '#test/helpers/entity-mock'
import {createMockContext} from '../helpers/lambda-context'
import {createMockDevice, createMockSQSFileNotificationEvent, createMockUserDevice} from '../helpers/test-data'

// Use path aliases matching handler imports for proper mock resolution
const publishSnsEventMock = jest.fn<() => Promise<{MessageId: string}>>()
jest.unstable_mockModule('#lib/vendor/AWS/SNS', () => ({publishSnsEvent: publishSnsEventMock, publish: publishSnsEventMock}))

const userDevicesMock = createEntityMock({queryIndexes: ['byUser']})
jest.unstable_mockModule('#entities/UserDevices', () => ({UserDevices: userDevicesMock.entity}))

const devicesMock = createEntityMock()
jest.unstable_mockModule('#entities/Devices', () => ({Devices: devicesMock.entity}))

const {handler} = await import('../../../src/lambdas/SendPushNotification/src/index')

type PublishCallArgs = [{TargetArn: string}]

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
    // Arrange: Mock ElectroDB responses
    // First query: getUserDevicesByUserId returns array of individual UserDevice records
    userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({data: [createMockUserDevice('user-123', 'device-abc')]})

    devicesMock.mocks.get.mockResolvedValue({
      data: createMockDevice({deviceId: 'device-abc', endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/test-endpoint'})
    })

    const event = createMockSQSFileNotificationEvent('user-123', 'video-123')

    await handler(event, createMockContext())

    expect(userDevicesMock.mocks.query.byUser!.go).toHaveBeenCalledTimes(1)
    expect(devicesMock.mocks.get).toHaveBeenCalledTimes(1)

    expect(publishSnsEventMock).toHaveBeenCalledTimes(1)

    const publishParams = (publishSnsEventMock.mock.calls as unknown as PublishCallArgs[])[0][0]
    expect(publishParams.TargetArn).toBe('arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/test-endpoint')
  })

  test('should fan-out to multiple devices when user has multiple registered devices', async () => {
    // Arrange: Mock ElectroDB responses
    // First query: getUserDevicesByUserId returns array of individual UserDevice records
    userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({
      data: [createMockUserDevice('user-456', 'device-1'), createMockUserDevice('user-456', 'device-2'), createMockUserDevice('user-456', 'device-3')]
    })

    devicesMock.mocks.get.mockResolvedValueOnce({
      data: createMockDevice({deviceId: 'device-1', endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/endpoint-1'})
    })

    devicesMock.mocks.get.mockResolvedValueOnce({
      data: createMockDevice({deviceId: 'device-2', endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/endpoint-2'})
    })

    devicesMock.mocks.get.mockResolvedValueOnce({
      data: createMockDevice({deviceId: 'device-3', endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/endpoint-3'})
    })

    const event = createMockSQSFileNotificationEvent('user-456', 'video-456', {title: 'Multi-Device Video'})

    await handler(event, createMockContext())

    // Assert: ElectroDB queried 4 times (1 UserDevices + 3 Devices)
    expect(userDevicesMock.mocks.query.byUser!.go).toHaveBeenCalledTimes(1)
    expect(devicesMock.mocks.get).toHaveBeenCalledTimes(3)

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
    // Arrange: Mock ElectroDB to return empty array (no devices)
    userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({data: []})

    const event = createMockSQSFileNotificationEvent('user-no-devices', 'video-789')

    await handler(event, createMockContext())

    // Assert: Only UserDevices queried, not Devices
    expect(userDevicesMock.mocks.query.byUser!.go).toHaveBeenCalledTimes(1)
    expect(devicesMock.mocks.get).not.toHaveBeenCalled()

    // Assert: No SNS publish (no devices to notify)
    expect(publishSnsEventMock).not.toHaveBeenCalled()
  })

  test('should handle invalid device gracefully and continue to next device', async () => {
    // Arrange: Mock ElectroDB responses
    userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({
      data: [createMockUserDevice('user-789', 'device-good'), createMockUserDevice('user-789', 'device-bad')]
    })

    devicesMock.mocks.get.mockResolvedValueOnce({
      data: createMockDevice({deviceId: 'device-good', endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/good-endpoint'})
    })

    // Second device query fails (device not found)
    devicesMock.mocks.get.mockResolvedValueOnce(undefined)

    const event = createMockSQSFileNotificationEvent('user-789', 'video-error')

    await expect(handler(event, createMockContext())).resolves.not.toThrow()

    expect(publishSnsEventMock).toHaveBeenCalledTimes(1)
    expect((publishSnsEventMock.mock.calls as unknown as PublishCallArgs[])[0][0].TargetArn).toBe(
      'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/good-endpoint'
    )
  })

  test('should process multiple SQS records in same batch', async () => {
    // Arrange: Mock ElectroDB responses for two different users
    userDevicesMock.mocks.query.byUser!.go.mockResolvedValueOnce({data: [createMockUserDevice('user-1', 'device-user1')]})
    devicesMock.mocks.get.mockResolvedValueOnce({
      data: createMockDevice({deviceId: 'device-user1', endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/user1-endpoint'})
    })

    userDevicesMock.mocks.query.byUser!.go.mockResolvedValueOnce({data: [createMockUserDevice('user-2', 'device-user2')]})
    devicesMock.mocks.get.mockResolvedValueOnce({
      data: createMockDevice({deviceId: 'device-user2', endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/user2-endpoint'})
    })

    const event1 = createMockSQSFileNotificationEvent('user-1', 'video-batch-1')
    const event2 = createMockSQSFileNotificationEvent('user-2', 'video-batch-2')
    const batchEvent: SQSEvent = {Records: [...event1.Records, ...event2.Records]}

    await handler(batchEvent, createMockContext())

    // Assert: ElectroDB queried 4 times (2 users × 2 queries each)
    expect(userDevicesMock.mocks.query.byUser!.go).toHaveBeenCalledTimes(2)
    expect(devicesMock.mocks.get).toHaveBeenCalledTimes(2)

    // Assert: SNS published 2 times (one per user)
    expect(publishSnsEventMock).toHaveBeenCalledTimes(2)
  })

  test('should skip non-FileNotification messages', async () => {
    // Arrange: SQS event with different message type
    const event: SQSEvent = {
      Records: [{
        messageId: 'test-message-6',
        receiptHandle: 'test-receipt-6',
        body: 'OtherNotificationType',
        attributes: {ApproximateReceiveCount: '1', SentTimestamp: '1234567890', SenderId: 'test-sender', ApproximateFirstReceiveTimestamp: '1234567890'},
        messageAttributes: {},
        md5OfBody: 'test-md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:test-queue',
        awsRegion: 'us-west-2'
      }]
    }

    // Act: Invoke handler
    await handler(event, createMockContext())

    // Assert: No ElectroDB queries
    expect(userDevicesMock.mocks.query.byUser!.go).not.toHaveBeenCalled()
    expect(devicesMock.mocks.get).not.toHaveBeenCalled()

    // Assert: No SNS publish
    expect(publishSnsEventMock).not.toHaveBeenCalled()
  })
})
