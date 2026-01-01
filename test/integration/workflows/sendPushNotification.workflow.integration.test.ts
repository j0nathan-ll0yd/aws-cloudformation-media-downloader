/**
 * SendPushNotification Workflow Integration Tests (True Integration)
 *
 * Tests the push notification workflow with REAL PostgreSQL and LocalStack SNS:
 * - Entity queries: Real Drizzle queries via getDrizzleClient()
 * - SNS: Uses REAL LocalStack for publishing notifications
 *
 * Workflow:
 * 1. Receive SQS FileNotification event
 * 2. Query UserDevices for user's devices (REAL PostgreSQL)
 * 3. Query Devices for each device's endpoint ARN (REAL PostgreSQL)
 * 4. Fan-out: Publish SNS notification to each device endpoint (REAL LocalStack)
 * 5. Handle errors gracefully (invalid devices, missing endpoints)
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'
import type {SQSEvent} from 'aws-lambda'

// Test helpers
import {createMockContext} from '../helpers/lambda-context'
import {createMockSQSFileNotificationEvent} from '../helpers/test-data'
import {closeTestDb, createAllTables, getTestDbAsync, insertDevice, insertUser, truncateAllTables, upsertUserDevice} from '../helpers/postgres-helpers'
import {createTestEndpoint, createTestPlatformApplication, deleteTestPlatformApplication, generateIsolatedAppName} from '../helpers/sns-helpers'

// No entity query mocks - uses REAL PostgreSQL via getDrizzleClient()
// No SNS mock - uses real LocalStack SNS

// Import handler - uses real database and real LocalStack
const {handler} = await import('#lambdas/SendPushNotification/src/index')

describe('SendPushNotification Workflow Integration Tests (True Integration)', () => {
  let platformAppArn: string
  let testEndpoint1: string
  let testEndpoint2: string
  let testEndpoint3: string
  const testAppName = generateIsolatedAppName('test-notification')

  beforeAll(async () => {
    // Initialize database connection and create tables
    await getTestDbAsync()
    await createAllTables()

    // Create real LocalStack SNS resources
    platformAppArn = await createTestPlatformApplication(testAppName)
    process.env.PLATFORM_APPLICATION_ARN = platformAppArn

    // Create real endpoints in LocalStack
    testEndpoint1 = await createTestEndpoint(platformAppArn, `device-token-1-${Date.now()}`)
    testEndpoint2 = await createTestEndpoint(platformAppArn, `device-token-2-${Date.now()}`)
    testEndpoint3 = await createTestEndpoint(platformAppArn, `device-token-3-${Date.now()}`)
  })

  afterEach(async () => {
    // Clean up database between tests
    await truncateAllTables()
  })

  afterAll(async () => {
    // Clean up LocalStack resources
    await deleteTestPlatformApplication(platformAppArn)
    // Close database connection
    await closeTestDb()
  })

  test('should query and publish SNS notification for single user with single device', async () => {
    const userId = crypto.randomUUID()
    const deviceId = `device-single-${Date.now()}`

    // Arrange: Create user, device, and user-device link in real database
    await insertUser({userId, email: `single-${Date.now()}@example.com`})
    await insertDevice({deviceId, token: `token-${deviceId}`, endpointArn: testEndpoint1})
    await upsertUserDevice({userId, deviceId})

    // Act
    const event = createMockSQSFileNotificationEvent(userId, 'video-123')
    const result = await handler(event, createMockContext())

    // Assert: No batch failures means SNS publish succeeded
    expect(result.batchItemFailures).toHaveLength(0)
  })

  test('should fan-out to multiple devices when user has multiple registered devices', async () => {
    const userId = crypto.randomUUID()
    const deviceConfigs = [
      {deviceId: `device-multi-1-${Date.now()}`, endpointArn: testEndpoint1},
      {deviceId: `device-multi-2-${Date.now()}`, endpointArn: testEndpoint2},
      {deviceId: `device-multi-3-${Date.now()}`, endpointArn: testEndpoint3}
    ]

    // Arrange: Create user with multiple devices in real database
    await insertUser({userId, email: `multi-${Date.now()}@example.com`})
    for (const config of deviceConfigs) {
      await insertDevice({deviceId: config.deviceId, token: `token-${config.deviceId}`, endpointArn: config.endpointArn})
      await upsertUserDevice({userId, deviceId: config.deviceId})
    }

    // Act
    const event = createMockSQSFileNotificationEvent(userId, 'video-multi', {title: 'Multi-Device Video'})
    const result = await handler(event, createMockContext())

    // Assert: All 3 devices should have received notifications via real LocalStack SNS
    expect(result.batchItemFailures).toHaveLength(0)
  })

  test('should return early when user has no registered devices', async () => {
    const userId = crypto.randomUUID()

    // Arrange: Create user with no devices in real database
    await insertUser({userId, email: `nodevices-${Date.now()}@example.com`})

    // Act
    const event = createMockSQSFileNotificationEvent(userId, 'video-no-devices')
    const result = await handler(event, createMockContext())

    // Assert
    expect(result.batchItemFailures).toHaveLength(0)
  })

  test('should handle device without endpoint ARN gracefully', async () => {
    const userId = crypto.randomUUID()
    const deviceId = `device-no-endpoint-${Date.now()}`

    // Arrange: Create user and device WITHOUT endpointArn in real database
    await insertUser({userId, email: `noendpoint-${Date.now()}@example.com`})
    await insertDevice({deviceId, token: `token-${deviceId}`}) // No endpointArn
    await upsertUserDevice({userId, deviceId})

    // Act
    const event = createMockSQSFileNotificationEvent(userId, 'video-error')
    const result = await handler(event, createMockContext())

    // Assert: Should report failure for missing endpoint
    expect(result.batchItemFailures).toHaveLength(1)
  })

  test('should process multiple SQS records in same batch', async () => {
    const user1Id = crypto.randomUUID()
    const user2Id = crypto.randomUUID()
    const device1Id = `device-batch-1-${Date.now()}`
    const device2Id = `device-batch-2-${Date.now()}`

    // Arrange: Create two users with one device each in real database
    await insertUser({userId: user1Id, email: `batch1-${Date.now()}@example.com`})
    await insertDevice({deviceId: device1Id, token: `token-${device1Id}`, endpointArn: testEndpoint1})
    await upsertUserDevice({userId: user1Id, deviceId: device1Id})

    await insertUser({userId: user2Id, email: `batch2-${Date.now()}@example.com`})
    await insertDevice({deviceId: device2Id, token: `token-${device2Id}`, endpointArn: testEndpoint2})
    await upsertUserDevice({userId: user2Id, deviceId: device2Id})

    // Act
    const event1 = createMockSQSFileNotificationEvent(user1Id, 'video-batch-1')
    const event2 = createMockSQSFileNotificationEvent(user2Id, 'video-batch-2')
    const batchEvent: SQSEvent = {Records: [...event1.Records, ...event2.Records]}

    const result = await handler(batchEvent, createMockContext())

    // Assert: Both users should have received notifications via real LocalStack SNS
    expect(result.batchItemFailures).toHaveLength(0)
  })

  test('should skip non-supported notification types', async () => {
    const userId = crypto.randomUUID()
    const deviceId = `device-skip-${Date.now()}`

    // Arrange: Create user and device in real database
    await insertUser({userId, email: `skip-${Date.now()}@example.com`})
    await insertDevice({deviceId, token: `token-${deviceId}`, endpointArn: testEndpoint1})
    await upsertUserDevice({userId, deviceId})

    // Act: Send unsupported notification type
    const event = createMockSQSFileNotificationEvent(userId, 'video-skip', undefined, 'UnsupportedNotificationType')
    const result = await handler(event, createMockContext())

    // Assert
    expect(result.batchItemFailures).toHaveLength(0)
  })

  test('should handle MetadataNotification type', async () => {
    const userId = crypto.randomUUID()
    const deviceId = `device-metadata-${Date.now()}`

    // Arrange: Create user and device in real database
    await insertUser({userId, email: `metadata-${Date.now()}@example.com`})
    await insertDevice({deviceId, token: `token-${deviceId}`, endpointArn: testEndpoint1})
    await upsertUserDevice({userId, deviceId})

    // Act
    const event = createMockSQSFileNotificationEvent(userId, 'video-metadata', {title: 'Metadata Update'}, 'MetadataNotification')
    const result = await handler(event, createMockContext())

    // Assert
    expect(result.batchItemFailures).toHaveLength(0)
  })
})
