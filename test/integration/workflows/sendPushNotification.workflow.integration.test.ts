/**
 * SendPushNotification Workflow Integration Tests
 *
 * Tests the push notification workflow:
 * - Entity queries: Mocked for device lookups (handlers use own Drizzle connection)
 * - SNS: Uses REAL LocalStack for publishing notifications
 *
 * Workflow:
 * 1. Receive SQS FileNotification event
 * 2. Query UserDevices for user's devices (mocked - handler uses own DB)
 * 3. Query Devices for each device's endpoint ARN (mocked)
 * 4. Fan-out: Publish SNS notification to each device endpoint (REAL LocalStack)
 * 5. Handle errors gracefully (invalid devices, missing endpoints)
 *
 * NOTE: Entity mocks remain because handlers use their own Drizzle connection.
 * Phase 4 will address full database integration.
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'

import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'
import type {SQSEvent} from 'aws-lambda'

// Test helpers
import {createMockContext} from '../helpers/lambda-context'
import {createMockDevice, createMockSQSFileNotificationEvent} from '../helpers/test-data'
import {createTestEndpoint, createTestPlatformApplication, deleteTestPlatformApplication, generateIsolatedAppName} from '../helpers/sns-helpers'

// Mock entity queries - must use vi.hoisted for ESM
// NOTE: These remain mocked because handlers use their own Drizzle connection
const {getDeviceMock, getUserDevicesByUserIdMock} = vi.hoisted(() => ({getDeviceMock: vi.fn(), getUserDevicesByUserIdMock: vi.fn()}))

vi.mock('#entities/queries', () => ({getDevice: getDeviceMock, getUserDevicesByUserId: getUserDevicesByUserIdMock}))

// NO SNS mock - uses real LocalStack SNS
// The handler calls publishSnsEvent from #lib/vendor/AWS/SNS which uses createSNSClient()
// createSNSClient() respects USE_LOCALSTACK=true and points to LocalStack

// Import handler after mocks
const {handler} = await import('#lambdas/SendPushNotification/src/index')

describe('SendPushNotification Workflow Integration Tests', () => {
  let platformAppArn: string
  let testEndpoint1: string
  let testEndpoint2: string
  let testEndpoint3: string
  const testAppName = generateIsolatedAppName('test-notification')

  beforeAll(async () => {
    // Create real LocalStack SNS resources
    platformAppArn = await createTestPlatformApplication(testAppName)
    process.env.PLATFORM_APPLICATION_ARN = platformAppArn

    // Create real endpoints in LocalStack
    testEndpoint1 = await createTestEndpoint(platformAppArn, `device-token-1-${Date.now()}`)
    testEndpoint2 = await createTestEndpoint(platformAppArn, `device-token-2-${Date.now()}`)
    testEndpoint3 = await createTestEndpoint(platformAppArn, `device-token-3-${Date.now()}`)
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock implementations
    getUserDevicesByUserIdMock.mockResolvedValue([])
    getDeviceMock.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  afterAll(async () => {
    // Clean up LocalStack resources
    await deleteTestPlatformApplication(platformAppArn)
  })

  test('should query and publish SNS notification for single user with single device', async () => {
    const userId = crypto.randomUUID()
    const deviceId = 'device-single-test'

    // Mock user has one device with real LocalStack endpoint
    getUserDevicesByUserIdMock.mockResolvedValue([{userId, deviceId}])
    getDeviceMock.mockResolvedValue(createMockDevice({deviceId, endpointArn: testEndpoint1}))

    const event = createMockSQSFileNotificationEvent(userId, 'video-123')
    const result = await handler(event, createMockContext())

    expect(result.batchItemFailures).toHaveLength(0)
    expect(getUserDevicesByUserIdMock).toHaveBeenCalledWith(userId)
    expect(getDeviceMock).toHaveBeenCalledWith(deviceId)
    // SNS publish happens to real LocalStack - success means no batch failures
  })

  test('should fan-out to multiple devices when user has multiple registered devices', async () => {
    const userId = crypto.randomUUID()
    const deviceConfigs = [
      {deviceId: 'device-multi-1', endpointArn: testEndpoint1},
      {deviceId: 'device-multi-2', endpointArn: testEndpoint2},
      {deviceId: 'device-multi-3', endpointArn: testEndpoint3}
    ]

    // Mock user has multiple devices with real LocalStack endpoints
    getUserDevicesByUserIdMock.mockResolvedValue(deviceConfigs.map((c) => ({userId, deviceId: c.deviceId})))
    getDeviceMock.mockImplementation((deviceId: string) => {
      const config = deviceConfigs.find((c) => c.deviceId === deviceId)
      return Promise.resolve(config ? createMockDevice(config) : null)
    })

    const event = createMockSQSFileNotificationEvent(userId, 'video-multi', {title: 'Multi-Device Video'})
    const result = await handler(event, createMockContext())

    expect(result.batchItemFailures).toHaveLength(0)
    // All 3 devices should have received notifications via real LocalStack SNS
  })

  test('should return early when user has no registered devices', async () => {
    const userId = crypto.randomUUID()

    // Mock user has no devices
    getUserDevicesByUserIdMock.mockResolvedValue([])

    const event = createMockSQSFileNotificationEvent(userId, 'video-no-devices')
    const result = await handler(event, createMockContext())

    expect(result.batchItemFailures).toHaveLength(0)
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
  })

  test('should process multiple SQS records in same batch', async () => {
    const user1Id = crypto.randomUUID()
    const user2Id = crypto.randomUUID()

    // Mock both users have devices with real LocalStack endpoints
    getUserDevicesByUserIdMock.mockImplementation((userId: string) => {
      if (userId === user1Id) {
        return Promise.resolve([{userId: user1Id, deviceId: 'device-batch-1'}])
      }
      if (userId === user2Id) {
        return Promise.resolve([{userId: user2Id, deviceId: 'device-batch-2'}])
      }
      return Promise.resolve([])
    })

    getDeviceMock.mockImplementation((deviceId: string) => {
      if (deviceId === 'device-batch-1') {
        return Promise.resolve(createMockDevice({deviceId, endpointArn: testEndpoint1}))
      }
      if (deviceId === 'device-batch-2') {
        return Promise.resolve(createMockDevice({deviceId, endpointArn: testEndpoint2}))
      }
      return Promise.resolve(null)
    })

    const event1 = createMockSQSFileNotificationEvent(user1Id, 'video-batch-1')
    const event2 = createMockSQSFileNotificationEvent(user2Id, 'video-batch-2')
    const batchEvent: SQSEvent = {Records: [...event1.Records, ...event2.Records]}

    const result = await handler(batchEvent, createMockContext())

    expect(result.batchItemFailures).toHaveLength(0)
    // Both users should have received notifications via real LocalStack SNS
  })

  test('should skip non-supported notification types', async () => {
    const userId = crypto.randomUUID()
    const deviceId = 'device-skip'

    getUserDevicesByUserIdMock.mockResolvedValue([{userId, deviceId}])
    getDeviceMock.mockResolvedValue(createMockDevice({deviceId, endpointArn: testEndpoint1}))

    const event = createMockSQSFileNotificationEvent(userId, 'video-skip', undefined, 'UnsupportedNotificationType')
    const result = await handler(event, createMockContext())

    expect(result.batchItemFailures).toHaveLength(0)
  })

  test('should handle MetadataNotification type', async () => {
    const userId = crypto.randomUUID()
    const deviceId = 'device-metadata'

    getUserDevicesByUserIdMock.mockResolvedValue([{userId, deviceId}])
    getDeviceMock.mockResolvedValue(createMockDevice({deviceId, endpointArn: testEndpoint1}))

    const event = createMockSQSFileNotificationEvent(userId, 'video-metadata', {title: 'Metadata Update'}, 'MetadataNotification')
    const result = await handler(event, createMockContext())

    expect(result.batchItemFailures).toHaveLength(0)
  })
})
