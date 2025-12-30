/**
 * SendPushNotification Workflow Integration Tests
 *
 * Tests the push notification workflow against real services:
 * - PostgreSQL: User, Device, and UserDevice records
 * - LocalStack SNS: Platform application and endpoints
 *
 * Workflow:
 * 1. Receive SQS FileNotification event
 * 2. Query PostgreSQL UserDevices for user's devices
 * 3. Query PostgreSQL Devices for each device's endpoint ARN
 * 4. Fan-out: Publish SNS notification to each device endpoint
 * 5. Handle errors gracefully (invalid devices, missing endpoints)
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'
import type {SQSEvent} from 'aws-lambda'

// Test helpers
import {closeTestDb, createAllTables, dropAllTables, insertDevice, insertUser, linkUserDevice, truncateAllTables} from '../helpers/postgres-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createTestEndpoint, createTestPlatformApplication, deleteTestPlatformApplication} from '../helpers/sns-helpers'

// Import handler directly (no mocking - uses real services)
const {handler} = await import('#lambdas/SendPushNotification/src/index')

/**
 * Creates an SQS event for file notification testing
 */
function createSQSFileNotificationEvent(userId: string, fileId: string, options?: {title?: string; notificationType?: string}): SQSEvent {
  const title = options?.title || 'Test Video'
  const notificationType = options?.notificationType || 'DownloadReadyNotification'

  return {
    Records: [{
      messageId: `test-message-${Date.now()}`,
      receiptHandle: 'test-receipt',
      body: JSON.stringify({fileId, title, authorName: 'Test Channel', status: 'Downloaded'}),
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: String(Date.now()),
        SenderId: 'test-sender',
        ApproximateFirstReceiveTimestamp: String(Date.now())
      },
      messageAttributes: {
        notificationType: {stringValue: notificationType, dataType: 'String'},
        userId: {stringValue: userId, dataType: 'String'},
        fileId: {stringValue: fileId, dataType: 'String'}
      },
      md5OfBody: 'test-md5',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:test-queue',
      awsRegion: 'us-west-2'
    }]
  }
}

// Skip in CI: Handler uses own Drizzle connection that doesn't respect worker schema isolation
describe.skipIf(Boolean(process.env.CI))('SendPushNotification Workflow Integration Tests', () => {
  let platformAppArn: string
  const testAppName = `test-push-app-${Date.now()}`

  beforeAll(async () => {
    // Create PostgreSQL tables
    await createAllTables()

    // Create LocalStack SNS platform application
    platformAppArn = await createTestPlatformApplication(testAppName)

    // Set environment variable for the Lambda
    process.env.PLATFORM_APPLICATION_ARN = platformAppArn
  })

  afterEach(async () => {
    // Clean up data between tests
    await truncateAllTables()
  })

  afterAll(async () => {
    // Clean up LocalStack SNS
    await deleteTestPlatformApplication(platformAppArn)

    // Drop tables and close connection
    await dropAllTables()
    await closeTestDb()
  })

  test('should query PostgreSQL and publish SNS notification for single user with single device', async () => {
    // Arrange: Create real data in PostgreSQL
    const userId = crypto.randomUUID()
    const deviceId = 'device-single-test'
    const deviceToken = `token-${Date.now()}`

    // Create SNS endpoint in LocalStack
    const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

    // Create user and device in PostgreSQL
    await insertUser({userId, email: 'single@example.com', firstName: 'Single'})
    await insertDevice({deviceId, token: deviceToken, endpointArn, name: 'Test iPhone'})
    await linkUserDevice(userId, deviceId)

    // Act: Invoke handler
    const event = createSQSFileNotificationEvent(userId, 'video-123')
    const result = await handler(event, createMockContext())

    // Assert: No failures (all messages processed successfully)
    expect(result.batchItemFailures).toHaveLength(0)
  })

  test('should fan-out to multiple devices when user has multiple registered devices', async () => {
    // Arrange: Create user with multiple devices
    const userId = crypto.randomUUID()
    const deviceConfigs = [
      {deviceId: 'device-multi-1', token: `token-multi-1-${Date.now()}`},
      {deviceId: 'device-multi-2', token: `token-multi-2-${Date.now()}`},
      {deviceId: 'device-multi-3', token: `token-multi-3-${Date.now()}`}
    ]

    await insertUser({userId, email: 'multi@example.com', firstName: 'Multi'})

    for (const config of deviceConfigs) {
      const endpointArn = await createTestEndpoint(platformAppArn, config.token)
      await insertDevice({deviceId: config.deviceId, token: config.token, endpointArn})
      await linkUserDevice(userId, config.deviceId)
    }

    // Act: Invoke handler
    const event = createSQSFileNotificationEvent(userId, 'video-multi', {title: 'Multi-Device Video'})
    const result = await handler(event, createMockContext())

    // Assert: All 3 devices received notifications (no failures)
    expect(result.batchItemFailures).toHaveLength(0)
  })

  test('should return early when user has no registered devices', async () => {
    // Arrange: Create user without any devices
    const userId = crypto.randomUUID()
    await insertUser({userId, email: 'nodevices@example.com', firstName: 'NoDevices'})

    // Act: Invoke handler
    const event = createSQSFileNotificationEvent(userId, 'video-no-devices')
    const result = await handler(event, createMockContext())

    // Assert: No failures (handler exits gracefully)
    expect(result.batchItemFailures).toHaveLength(0)
  })

  test('should handle device without endpoint ARN gracefully', async () => {
    // Arrange: Create user with device that has no endpointArn
    const userId = crypto.randomUUID()
    const deviceId = 'device-no-endpoint'

    await insertUser({userId, email: 'noendpoint@example.com', firstName: 'NoEndpoint'})
    await insertDevice({deviceId, token: 'some-token'}) // No endpointArn
    await linkUserDevice(userId, deviceId)

    // Act: Invoke handler
    const event = createSQSFileNotificationEvent(userId, 'video-error')

    // The handler should fail because device has no endpointArn
    const result = await handler(event, createMockContext())

    // Assert: This message should fail since no valid endpoint
    expect(result.batchItemFailures).toHaveLength(1)
  })

  test('should process multiple SQS records in same batch', async () => {
    // Arrange: Create two users with devices
    const user1Id = crypto.randomUUID()
    const user2Id = crypto.randomUUID()

    await insertUser({userId: user1Id, email: 'batch1@example.com', firstName: 'Batch1'})
    await insertUser({userId: user2Id, email: 'batch2@example.com', firstName: 'Batch2'})

    const endpoint1 = await createTestEndpoint(platformAppArn, `token-batch-1-${Date.now()}`)
    const endpoint2 = await createTestEndpoint(platformAppArn, `token-batch-2-${Date.now()}`)

    await insertDevice({deviceId: 'device-batch-1', token: 'token-batch-1', endpointArn: endpoint1})
    await insertDevice({deviceId: 'device-batch-2', token: 'token-batch-2', endpointArn: endpoint2})

    await linkUserDevice(user1Id, 'device-batch-1')
    await linkUserDevice(user2Id, 'device-batch-2')

    // Act: Create batch event with two records
    const event1 = createSQSFileNotificationEvent(user1Id, 'video-batch-1')
    const event2 = createSQSFileNotificationEvent(user2Id, 'video-batch-2')
    const batchEvent: SQSEvent = {Records: [...event1.Records, ...event2.Records]}

    const result = await handler(batchEvent, createMockContext())

    // Assert: Both messages processed successfully
    expect(result.batchItemFailures).toHaveLength(0)
  })

  test('should skip non-supported notification types', async () => {
    // Arrange: Create user with device
    const userId = crypto.randomUUID()
    await insertUser({userId, email: 'skiptype@example.com', firstName: 'SkipType'})

    const endpoint = await createTestEndpoint(platformAppArn, `token-skip-${Date.now()}`)
    await insertDevice({deviceId: 'device-skip', token: 'token-skip', endpointArn: endpoint})
    await linkUserDevice(userId, 'device-skip')

    // Act: Send unsupported notification type
    const event = createSQSFileNotificationEvent(userId, 'video-skip', {notificationType: 'UnsupportedNotificationType'})
    const result = await handler(event, createMockContext())

    // Assert: No failures (skipped gracefully)
    expect(result.batchItemFailures).toHaveLength(0)
  })

  test('should handle MetadataNotification type', async () => {
    // Arrange: Create user with device
    const userId = crypto.randomUUID()

    await insertUser({userId, email: 'metadata@example.com', firstName: 'Metadata'})

    const endpoint = await createTestEndpoint(platformAppArn, `token-metadata-${Date.now()}`)
    await insertDevice({deviceId: 'device-metadata', token: 'token-metadata', endpointArn: endpoint})
    await linkUserDevice(userId, 'device-metadata')

    // Act: Send MetadataNotification
    const event = createSQSFileNotificationEvent(userId, 'video-metadata', {notificationType: 'MetadataNotification', title: 'Metadata Update'})
    const result = await handler(event, createMockContext())

    // Assert: Processed successfully
    expect(result.batchItemFailures).toHaveLength(0)
  })
})
