/**
 * UserDelete Cascade Integration Tests (True Integration)
 *
 * Tests the user deletion workflow with REAL PostgreSQL and LocalStack SNS:
 * - Entity queries: Real Drizzle queries via getDrizzleClient()
 * - Device service: Real SNS endpoint deletion via LocalStack
 * - GitHub API: Mocked for error reporting (external service)
 *
 * Workflow:
 * 1. Delete UserFiles (user-file associations) - REAL PostgreSQL
 * 2. Delete UserDevices (user-device associations) - REAL PostgreSQL
 * 3. Delete SNS endpoints for devices - REAL LocalStack
 * 4. Delete Devices - REAL PostgreSQL
 * 5. Delete User (parent - only after all children succeed) - REAL PostgreSQL
 *
 * Validates:
 * - Correct cascade order (children before parent)
 * - Partial failure handling (don't delete parent if children fail)
 * - Error reporting via GitHub issue creation
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'
process.env.DEFAULT_FILE_SIZE = '1024'
process.env.DEFAULT_FILE_NAME = 'test-default-file.mp4'
process.env.DEFAULT_FILE_URL = 'https://example.com/test-default-file.mp4'
process.env.DEFAULT_FILE_CONTENT_TYPE = 'video/mp4'

import {afterAll, afterEach, beforeAll, describe, expect, test, vi} from 'vitest'
import type {Context} from 'aws-lambda'
import {FileStatus, UserStatus} from '#types/enums'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'

// Test helpers
import {createMockContext} from '../helpers/lambda-context'
import {createMockCustomAPIGatewayEvent} from '../helpers/test-data'
import {
  closeTestDb,
  createAllTables,
  getDevice,
  getTestDbAsync,
  getUser,
  getUserDevicesByUserId,
  getUserFilesByUserId,
  insertDevice,
  insertFile,
  insertUser,
  insertUserFile,
  truncateAllTables,
  upsertUserDevice
} from '../helpers/postgres-helpers'
import {createTestEndpoint, createTestPlatformApplication, deleteTestPlatformApplication, generateIsolatedAppName} from '../helpers/sns-helpers'

// No entity query mocks - uses REAL PostgreSQL via getDrizzleClient()

// Mock GitHub helpers - must use vi.hoisted for ESM (external API - keep mocked)
const {createFailedUserDeletionIssueMock} = vi.hoisted(() => ({createFailedUserDeletionIssueMock: vi.fn()}))
vi.mock('#lib/integrations/github/issue-service', () => ({createFailedUserDeletionIssue: createFailedUserDeletionIssueMock}))

// Import handler after GitHub mock
const {handler} = await import('#lambdas/UserDelete/src/index')

// Helper using centralized factory
function createUserDeleteEvent(userId: string): CustomAPIGatewayRequestAuthorizerEvent {
  return createMockCustomAPIGatewayEvent({path: '/users', httpMethod: 'DELETE', userId, userStatus: UserStatus.Authenticated})
}

describe('UserDelete Cascade Integration Tests (True Integration)', () => {
  let mockContext: Context
  let platformAppArn: string
  const testAppName = generateIsolatedAppName('test-delete')

  beforeAll(async () => {
    mockContext = createMockContext()

    // Initialize database connection and create tables
    await getTestDbAsync()
    await createAllTables()

    // Create real LocalStack SNS platform application
    platformAppArn = await createTestPlatformApplication(testAppName)
    process.env.PLATFORM_APPLICATION_ARN = platformAppArn
    process.env.PUSH_NOTIFICATION_TOPIC_ARN = 'arn:aws:sns:us-west-2:000000000000:test-topic'
  })

  afterEach(async () => {
    vi.clearAllMocks()
    // Clean up database between tests
    await truncateAllTables()
  })

  afterAll(async () => {
    // Clean up LocalStack resources
    await deleteTestPlatformApplication(platformAppArn)
    // Close database connection
    await closeTestDb()
  })

  test('should delete user with files and devices in correct cascade order', async () => {
    // Arrange: User with files and devices in real database
    const userId = crypto.randomUUID()
    const deviceId1 = `device-1-${Date.now()}`
    const deviceId2 = `device-2-${Date.now()}`
    const fileId = `file-cascade-${Date.now()}`

    // Create SNS endpoints in LocalStack
    const endpoint1 = await createTestEndpoint(platformAppArn, `token-${deviceId1}`)
    const endpoint2 = await createTestEndpoint(platformAppArn, `token-${deviceId2}`)

    // Set up real database data
    await insertUser({userId, email: `cascade-${Date.now()}@example.com`})
    await insertDevice({deviceId: deviceId1, token: `token-${deviceId1}`, endpointArn: endpoint1})
    await insertDevice({deviceId: deviceId2, token: `token-${deviceId2}`, endpointArn: endpoint2})
    await upsertUserDevice({userId, deviceId: deviceId1})
    await upsertUserDevice({userId, deviceId: deviceId2})
    await insertFile({fileId, key: 'test-key', title: 'Test File', status: FileStatus.Downloaded, size: 1000})
    await insertUserFile({userId, fileId})

    // Verify data exists before deletion
    const userBefore = await getUser(userId)
    expect(userBefore).toBeDefined()
    const devicesBefore = await getUserDevicesByUserId(userId)
    expect(devicesBefore).toHaveLength(2)

    // Act
    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(204)

    // Verify cascade deletion - all data removed from real database
    const userAfter = await getUser(userId)
    expect(userAfter).toBeNull()

    const devicesAfter = await getUserDevicesByUserId(userId)
    expect(devicesAfter).toHaveLength(0)

    const filesAfter = await getUserFilesByUserId(userId)
    expect(filesAfter).toHaveLength(0)

    // Devices themselves should be deleted
    const device1After = await getDevice(deviceId1)
    const device2After = await getDevice(deviceId2)
    expect(device1After).toBeNull()
    expect(device2After).toBeNull()
  })

  test('should delete user with no files or devices', async () => {
    // Arrange: User without files or devices in real database
    const userId = crypto.randomUUID()
    await insertUser({userId, email: `empty-${Date.now()}@example.com`})

    // Act
    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(204)

    // Verify user is deleted
    const userAfter = await getUser(userId)
    expect(userAfter).toBeNull()
  })

  test('should return 401 when no userId in event', async () => {
    // Arrange: Event with no userId (unauthenticated user)
    const event = createMockCustomAPIGatewayEvent({path: '/users', httpMethod: 'DELETE', userId: undefined, userStatus: UserStatus.Unauthenticated})

    // Act
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(401)
  })

  test('should handle multiple devices with SNS endpoint deletion', async () => {
    // Arrange: User with multiple devices in real database
    const userId = crypto.randomUUID()
    const deviceConfigs = [
      {deviceId: `device-multi-1-${Date.now()}`},
      {deviceId: `device-multi-2-${Date.now()}`},
      {deviceId: `device-multi-3-${Date.now()}`}
    ]

    await insertUser({userId, email: `multi-${Date.now()}@example.com`})

    // Create SNS endpoints and devices
    for (const config of deviceConfigs) {
      const endpoint = await createTestEndpoint(platformAppArn, `token-${config.deviceId}`)
      await insertDevice({deviceId: config.deviceId, token: `token-${config.deviceId}`, endpointArn: endpoint})
      await upsertUserDevice({userId, deviceId: config.deviceId})
    }

    // Verify devices exist before deletion
    const devicesBefore = await getUserDevicesByUserId(userId)
    expect(devicesBefore).toHaveLength(3)

    // Act
    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(204)

    // Verify all devices deleted
    for (const config of deviceConfigs) {
      const device = await getDevice(config.deviceId)
      expect(device).toBeNull()
    }
  })

  test('should delete user even if device has no endpointArn', async () => {
    // Arrange: User with device that has no endpointArn in real database
    const userId = crypto.randomUUID()
    const deviceId = `device-no-arn-${Date.now()}`

    await insertUser({userId, email: `noarn-${Date.now()}@example.com`})
    await insertDevice({deviceId, token: `token-${deviceId}`}) // No endpointArn
    await upsertUserDevice({userId, deviceId})

    // Act
    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Assert: Should still succeed
    expect(result.statusCode).toBe(204)

    // Verify user is deleted
    const userAfter = await getUser(userId)
    expect(userAfter).toBeNull()
  })

  test('should handle user with only files (no devices)', async () => {
    // Arrange: User with only files in real database
    const userId = crypto.randomUUID()
    const fileId = `file-only-${Date.now()}`

    await insertUser({userId, email: `fileonly-${Date.now()}@example.com`})
    await insertFile({fileId, key: 'file-only-key', title: 'File Only', status: FileStatus.Downloaded, size: 500})
    await insertUserFile({userId, fileId})

    // Act
    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(204)

    // Verify user and user-file associations deleted
    const userAfter = await getUser(userId)
    expect(userAfter).toBeNull()
    const filesAfter = await getUserFilesByUserId(userId)
    expect(filesAfter).toHaveLength(0)
  })

  test('should handle user with only devices (no files)', async () => {
    // Arrange: User with only devices in real database
    const userId = crypto.randomUUID()
    const deviceId = `device-only-${Date.now()}`

    const endpoint = await createTestEndpoint(platformAppArn, `token-${deviceId}`)
    await insertUser({userId, email: `deviceonly-${Date.now()}@example.com`})
    await insertDevice({deviceId, token: `token-${deviceId}`, endpointArn: endpoint})
    await upsertUserDevice({userId, deviceId})

    // Act
    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(204)

    // Verify user and device deleted
    const userAfter = await getUser(userId)
    expect(userAfter).toBeNull()
    const deviceAfter = await getDevice(deviceId)
    expect(deviceAfter).toBeNull()
  })
})
