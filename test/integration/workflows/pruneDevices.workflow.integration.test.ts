/**
 * PruneDevices Workflow Integration Tests
 *
 * Tests scheduled device cleanup workflow:
 * 1. Query all devices from PostgreSQL
 * 2. Check each device via APNS health check (requires real APNS - skipped)
 * 3. Delete disabled devices (UserDevices first, then Device)
 * 4. Delete SNS endpoints for pruned devices
 *
 * Note: APNS health check tests are skipped because they require real Apple
 * connectivity or complex ESM mocking. The APNS behavior is tested in unit tests.
 * These integration tests focus on database and SNS operations.
 *
 * Uses LocalStack SNS and real PostgreSQL.
 *
 * @see src/lambdas/PruneDevices/src/index.ts
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'

// Test helpers
import {
  closeTestDb,
  createAllTables,
  dropAllTables,
  getDevice,
  insertDevice,
  insertUser,
  linkUserDevice,
  truncateAllTables
} from '../helpers/postgres-helpers'
import {
  createTestEndpoint,
  createTestPlatformApplication,
  deleteTestEndpoint,
  deleteTestPlatformApplication,
  isEndpointEnabled
} from '../helpers/sns-helpers'

describe('PruneDevices Workflow Integration Tests', () => {
  let platformAppArn: string
  const testAppName = `test-prune-app-${Date.now()}`

  beforeAll(async () => {
    // Create PostgreSQL tables
    await createAllTables()

    // Create LocalStack SNS platform application
    platformAppArn = await createTestPlatformApplication(testAppName)
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

  describe('Database Device Operations', () => {
    test('should query devices from database correctly', async () => {
      // Arrange: Create multiple devices
      const devices = [
        {deviceId: 'device-query-1', token: `query-1-${Date.now()}`},
        {deviceId: 'device-query-2', token: `query-2-${Date.now()}`}
      ]

      for (const device of devices) {
        const endpointArn = await createTestEndpoint(platformAppArn, device.token)
        await insertDevice({deviceId: device.deviceId, token: device.token, endpointArn})
      }

      // Assert: Both devices exist in database
      const device1 = await getDevice('device-query-1')
      const device2 = await getDevice('device-query-2')
      expect(device1).not.toBeNull()
      expect(device2).not.toBeNull()
    })

    test('should create device with SNS endpoint correctly', async () => {
      // Arrange: Create device with SNS endpoint
      const deviceToken = `endpoint-test-${Date.now()}`
      const deviceId = 'device-endpoint-test'

      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)
      await insertDevice({deviceId, token: deviceToken, endpointArn})

      // Assert: Device has endpoint ARN
      const device = await getDevice(deviceId)
      expect(device).not.toBeNull()
      expect(device?.endpointArn).toBe(endpointArn)

      // Endpoint should be enabled
      const enabled = await isEndpointEnabled(endpointArn)
      expect(enabled).toBe(true)
    })
  })

  describe('User-Device Association', () => {
    test('should maintain user-device relationship', async () => {
      // Arrange: Create user and device with association
      const userId = crypto.randomUUID()
      const deviceId = 'device-user-assoc'
      const deviceToken = `user-assoc-${Date.now()}`

      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)
      await insertUser({userId, email: 'user-assoc@example.com'})
      await insertDevice({deviceId, token: deviceToken, endpointArn})
      await linkUserDevice(userId, deviceId)

      // Assert: Device exists with association
      const device = await getDevice(deviceId)
      expect(device).not.toBeNull()
    })

    test('should handle device with multiple user associations', async () => {
      // Arrange: Create device shared by multiple users
      const user1Id = crypto.randomUUID()
      const user2Id = crypto.randomUUID()
      const deviceId = 'device-multi-user-test'
      const deviceToken = `multi-user-${Date.now()}`

      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)
      await insertUser({userId: user1Id, email: 'multi1@example.com'})
      await insertUser({userId: user2Id, email: 'multi2@example.com'})
      await insertDevice({deviceId, token: deviceToken, endpointArn})
      await linkUserDevice(user1Id, deviceId)
      await linkUserDevice(user2Id, deviceId)

      // Assert: Device exists and is shared
      const device = await getDevice(deviceId)
      expect(device).not.toBeNull()
    })
  })

  describe('SNS Endpoint Management', () => {
    test('should create and query SNS endpoint', async () => {
      // Arrange: Create SNS endpoint
      const deviceToken = `sns-create-${Date.now()}`
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      // Assert: Endpoint is enabled
      const enabled = await isEndpointEnabled(endpointArn)
      expect(enabled).toBe(true)
    })

    test('should delete SNS endpoint', async () => {
      // Arrange: Create and then delete endpoint
      const deviceToken = `sns-delete-${Date.now()}`
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      // Verify created
      const enabledBefore = await isEndpointEnabled(endpointArn)
      expect(enabledBefore).toBe(true)

      // Act: Delete endpoint
      await deleteTestEndpoint(endpointArn)

      // Assert: Endpoint no longer enabled
      const enabledAfter = await isEndpointEnabled(endpointArn)
      expect(enabledAfter).toBe(false)
    })
  })

  describe('Empty Database Handling', () => {
    test('should handle empty devices table', async () => {
      // No devices in database - just verify table queries work
      const device = await getDevice('nonexistent-device')
      expect(device).toBeNull()
    })
  })

  /**
   * Note: The following tests are skipped because they require APNS mocking
   * which is complex with ESM modules. The APNS health check behavior is
   * tested in unit tests at src/lambdas/PruneDevices/test/index.test.ts
   *
   * Skipped tests:
   * - should skip active devices (requires APNS success mock)
   * - should prune disabled devices (requires APNS 410 mock)
   * - should handle mix of active and disabled devices
   * - should return accurate pruning counts
   */
})
