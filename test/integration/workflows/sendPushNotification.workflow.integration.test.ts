/**
 * SendPushNotification Workflow Integration Tests
 *
 * Tests the push notification workflow:
 * - Entity queries: Mocked for device lookups
 * - SNS: Mocked for publishing notifications
 *
 * Workflow:
 * 1. Receive SQS FileNotification event
 * 2. Query UserDevices for user's devices (mocked)
 * 3. Query Devices for each device's endpoint ARN (mocked)
 * 4. Fan-out: Publish SNS notification to each device endpoint (mocked)
 * 5. Handle errors gracefully (invalid devices, missing endpoints)
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.PLATFORM_APPLICATION_ARN = 'arn:aws:sns:us-west-2:000000000000:app/APNS/test-app'

import {afterEach, beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'
import type {SQSEvent} from 'aws-lambda'

// Test helpers
import {createMockContext} from '../helpers/lambda-context'
import {createMockSQSFileNotificationEvent, createMockDevice} from '../helpers/test-data'

// Mock entity queries - must use vi.hoisted for ESM
const {getDeviceMock, getUserDevicesByUserIdMock} = vi.hoisted(() => ({
  getDeviceMock: vi.fn(),
  getUserDevicesByUserIdMock: vi.fn()
}))

vi.mock('#entities/queries', () => ({
  getDevice: getDeviceMock,
  getUserDevicesByUserId: getUserDevicesByUserIdMock
}))

// Mock SNS vendor - must use vi.hoisted for ESM
const {publishSnsEventMock} = vi.hoisted(() => ({publishSnsEventMock: vi.fn()}))

vi.mock('#lib/vendor/AWS/SNS', () => ({publishSnsEvent: publishSnsEventMock}))

// Import handler after mocks
const {handler} = await import('#lambdas/SendPushNotification/src/index')

describe('SendPushNotification Workflow Integration Tests', () => {
  beforeAll(() => {
    // No database setup needed - we're mocking everything
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock implementations
    getUserDevicesByUserIdMock.mockResolvedValue([])
    getDeviceMock.mockResolvedValue(null)
    publishSnsEventMock.mockResolvedValue({MessageId: 'test-msg-id'})
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('should query and publish SNS notification for single user with single device', async () => {
    const userId = crypto.randomUUID()
    const deviceId = 'device-single-test'
    const endpointArn = 'arn:aws:sns:us-west-2:000000000000:endpoint/APNS/test-app/test-endpoint'

    // Mock user has one device
    getUserDevicesByUserIdMock.mockResolvedValue([{userId, deviceId}])
    getDeviceMock.mockResolvedValue(createMockDevice({deviceId, endpointArn}))

    const event = createMockSQSFileNotificationEvent(userId, 'video-123')
    const result = await handler(event, createMockContext())

    expect(result.batchItemFailures).toHaveLength(0)
    expect(getUserDevicesByUserIdMock).toHaveBeenCalledWith(userId)
    expect(getDeviceMock).toHaveBeenCalledWith(deviceId)
    expect(publishSnsEventMock).toHaveBeenCalledWith(expect.objectContaining({TargetArn: endpointArn}))
  })

  test('should fan-out to multiple devices when user has multiple registered devices', async () => {
    const userId = crypto.randomUUID()
    const deviceConfigs = [
      {deviceId: 'device-multi-1', endpointArn: 'arn:aws:sns:us-west-2:000000000000:endpoint/APNS/test-app/endpoint-1'},
      {deviceId: 'device-multi-2', endpointArn: 'arn:aws:sns:us-west-2:000000000000:endpoint/APNS/test-app/endpoint-2'},
      {deviceId: 'device-multi-3', endpointArn: 'arn:aws:sns:us-west-2:000000000000:endpoint/APNS/test-app/endpoint-3'}
    ]

    // Mock user has multiple devices
    getUserDevicesByUserIdMock.mockResolvedValue(deviceConfigs.map(c => ({userId, deviceId: c.deviceId})))
    getDeviceMock.mockImplementation((deviceId: string) => {
      const config = deviceConfigs.find(c => c.deviceId === deviceId)
      return Promise.resolve(config ? createMockDevice(config) : null)
    })

    const event = createMockSQSFileNotificationEvent(userId, 'video-multi', {title: 'Multi-Device Video'})
    const result = await handler(event, createMockContext())

    expect(result.batchItemFailures).toHaveLength(0)
    expect(publishSnsEventMock).toHaveBeenCalledTimes(3)
  })

  test('should return early when user has no registered devices', async () => {
    const userId = crypto.randomUUID()

    // Mock user has no devices
    getUserDevicesByUserIdMock.mockResolvedValue([])

    const event = createMockSQSFileNotificationEvent(userId, 'video-no-devices')
    const result = await handler(event, createMockContext())

    expect(result.batchItemFailures).toHaveLength(0)
    expect(publishSnsEventMock).not.toHaveBeenCalled()
  })

  test('should handle device without endpoint ARN gracefully', async () => {
    const userId = crypto.randomUUID()
    const deviceId = 'device-no-endpoint'

    // Mock user has device without endpointArn
    getUserDevicesByUserIdMock.mockResolvedValue([{userId, deviceId}])
    getDeviceMock.mockResolvedValue(createMockDevice({deviceId, endpointArn: undefined}))

    const event = createMockSQSFileNotificationEvent(userId, 'video-error')
    const result = await handler(event, createMockContext())

    // Should report failure for missing endpoint
    expect(result.batchItemFailures).toHaveLength(1)
    expect(publishSnsEventMock).not.toHaveBeenCalled()
  })

  test('should process multiple SQS records in same batch', async () => {
    const user1Id = crypto.randomUUID()
    const user2Id = crypto.randomUUID()

    // Mock both users have devices
    getUserDevicesByUserIdMock.mockImplementation((userId: string) => {
      if (userId === user1Id) return Promise.resolve([{userId: user1Id, deviceId: 'device-batch-1'}])
      if (userId === user2Id) return Promise.resolve([{userId: user2Id, deviceId: 'device-batch-2'}])
      return Promise.resolve([])
    })

    getDeviceMock.mockImplementation((deviceId: string) => {
      if (deviceId === 'device-batch-1') {
        return Promise.resolve(createMockDevice({deviceId, endpointArn: 'arn:aws:sns:us-west-2:000000000000:endpoint/APNS/test-app/endpoint-batch-1'}))
      }
      if (deviceId === 'device-batch-2') {
        return Promise.resolve(createMockDevice({deviceId, endpointArn: 'arn:aws:sns:us-west-2:000000000000:endpoint/APNS/test-app/endpoint-batch-2'}))
      }
      return Promise.resolve(null)
    })

    const event1 = createMockSQSFileNotificationEvent(user1Id, 'video-batch-1')
    const event2 = createMockSQSFileNotificationEvent(user2Id, 'video-batch-2')
    const batchEvent: SQSEvent = {Records: [...event1.Records, ...event2.Records]}

    const result = await handler(batchEvent, createMockContext())

    expect(result.batchItemFailures).toHaveLength(0)
    expect(publishSnsEventMock).toHaveBeenCalledTimes(2)
  })

  test('should skip non-supported notification types', async () => {
    const userId = crypto.randomUUID()
    const deviceId = 'device-skip'

    getUserDevicesByUserIdMock.mockResolvedValue([{userId, deviceId}])
    getDeviceMock.mockResolvedValue(createMockDevice({deviceId, endpointArn: 'arn:aws:sns:us-west-2:000000000000:endpoint/APNS/test-app/endpoint-skip'}))

    const event = createMockSQSFileNotificationEvent(userId, 'video-skip', undefined, 'UnsupportedNotificationType')
    const result = await handler(event, createMockContext())

    expect(result.batchItemFailures).toHaveLength(0)
  })

  test('should handle MetadataNotification type', async () => {
    const userId = crypto.randomUUID()
    const deviceId = 'device-metadata'
    const endpointArn = 'arn:aws:sns:us-west-2:000000000000:endpoint/APNS/test-app/endpoint-metadata'

    getUserDevicesByUserIdMock.mockResolvedValue([{userId, deviceId}])
    getDeviceMock.mockResolvedValue(createMockDevice({deviceId, endpointArn}))

    const event = createMockSQSFileNotificationEvent(userId, 'video-metadata', {title: 'Metadata Update'}, 'MetadataNotification')
    const result = await handler(event, createMockContext())

    expect(result.batchItemFailures).toHaveLength(0)
  })
})
