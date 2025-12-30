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
import {createMockSQSFileNotificationEvent} from '../helpers/test-data'

// Import handler directly (no mocking - uses real services)
const {handler} = await import('#lambdas/SendPushNotification/src/index')

describe('SendPushNotification Workflow Integration Tests', () => {
  let platformAppArn: string
  const testAppName = `test-push-app-${Date.now()}`

  beforeAll(async () => {
    await createAllTables()
    platformAppArn = await createTestPlatformApplication(testAppName)
    process.env.PLATFORM_APPLICATION_ARN = platformAppArn
  })

  afterEach(async () => {
    await truncateAllTables()
  })

  afterAll(async () => {
    await deleteTestPlatformApplication(platformAppArn)
    await dropAllTables()
    await closeTestDb()
  })

  test('should query PostgreSQL and publish SNS notification for single user with single device', async () => {
    const userId = crypto.randomUUID()
    const deviceId = 'device-single-test'
    const deviceToken = `token-${Date.now()}`

    const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

    await insertUser({userId, email: 'single@example.com', firstName: 'Single'})
    await insertDevice({deviceId, token: deviceToken, endpointArn, name: 'Test iPhone'})
    await linkUserDevice(userId, deviceId)

    const event = createMockSQSFileNotificationEvent(userId, 'video-123')
    const result = await handler(event, createMockContext())

    expect(result.batchItemFailures).toHaveLength(0)
  })

  test('should fan-out to multiple devices when user has multiple registered devices', async () => {
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

    const event = createMockSQSFileNotificationEvent(userId, 'video-multi', {title: 'Multi-Device Video'})
    const result = await handler(event, createMockContext())

    expect(result.batchItemFailures).toHaveLength(0)
  })

  test('should return early when user has no registered devices', async () => {
    const userId = crypto.randomUUID()
    await insertUser({userId, email: 'nodevices@example.com', firstName: 'NoDevices'})

    const event = createMockSQSFileNotificationEvent(userId, 'video-no-devices')
    const result = await handler(event, createMockContext())

    expect(result.batchItemFailures).toHaveLength(0)
  })

  test('should handle device without endpoint ARN gracefully', async () => {
    const userId = crypto.randomUUID()
    const deviceId = 'device-no-endpoint'

    await insertUser({userId, email: 'noendpoint@example.com', firstName: 'NoEndpoint'})
    await insertDevice({deviceId, token: 'some-token'})
    await linkUserDevice(userId, deviceId)

    const event = createMockSQSFileNotificationEvent(userId, 'video-error')
    const result = await handler(event, createMockContext())

    expect(result.batchItemFailures).toHaveLength(1)
  })

  test('should process multiple SQS records in same batch', async () => {
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

    const event1 = createMockSQSFileNotificationEvent(user1Id, 'video-batch-1')
    const event2 = createMockSQSFileNotificationEvent(user2Id, 'video-batch-2')
    const batchEvent: SQSEvent = {Records: [...event1.Records, ...event2.Records]}

    const result = await handler(batchEvent, createMockContext())

    expect(result.batchItemFailures).toHaveLength(0)
  })

  test('should skip non-supported notification types', async () => {
    const userId = crypto.randomUUID()
    await insertUser({userId, email: 'skiptype@example.com', firstName: 'SkipType'})

    const endpoint = await createTestEndpoint(platformAppArn, `token-skip-${Date.now()}`)
    await insertDevice({deviceId: 'device-skip', token: 'token-skip', endpointArn: endpoint})
    await linkUserDevice(userId, 'device-skip')

    const event = createMockSQSFileNotificationEvent(userId, 'video-skip', undefined, 'UnsupportedNotificationType')
    const result = await handler(event, createMockContext())

    expect(result.batchItemFailures).toHaveLength(0)
  })

  test('should handle MetadataNotification type', async () => {
    const userId = crypto.randomUUID()

    await insertUser({userId, email: 'metadata@example.com', firstName: 'Metadata'})

    const endpoint = await createTestEndpoint(platformAppArn, `token-metadata-${Date.now()}`)
    await insertDevice({deviceId: 'device-metadata', token: 'token-metadata', endpointArn: endpoint})
    await linkUserDevice(userId, 'device-metadata')

    const event = createMockSQSFileNotificationEvent(userId, 'video-metadata', {title: 'Metadata Update'}, 'MetadataNotification')
    const result = await handler(event, createMockContext())

    expect(result.batchItemFailures).toHaveLength(0)
  })
})
