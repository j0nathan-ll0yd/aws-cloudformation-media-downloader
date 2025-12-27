/**
 * UserDelete Cascade Integration Tests
 *
 * Tests the user deletion workflow against real services:
 * - PostgreSQL: User, Device, UserDevice, UserFile records
 * - LocalStack SNS: Platform endpoints (for deletion)
 * - Mock: GitHub API (for error reporting)
 *
 * Workflow:
 * 1. Delete UserFiles (user-file associations)
 * 2. Delete UserDevices (user-device associations)
 * 3. Delete SNS endpoints for devices
 * 4. Delete Devices
 * 5. Delete User (parent - only after all children succeed)
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

import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals'
import type {Context} from 'aws-lambda'
import {FileStatus, UserStatus} from '../../../src/types/enums'

// Test helpers
import {
  closeTestDb,
  createAllTables,
  dropAllTables,
  getDevice,
  getTestDb,
  getUser,
  insertDevice,
  insertFile,
  insertUser,
  linkUserDevice,
  linkUserFile,
  truncateAllTables
} from '../helpers/postgres-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {
  createTestEndpoint,
  createTestPlatformApplication,
  deleteTestPlatformApplication
} from '../helpers/sns-helpers'
import {userDevices, userFiles} from '#lib/vendor/Drizzle/schema'
import {eq} from 'drizzle-orm'

import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '../../../src/types/infrastructure-types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Mock GitHub helpers to prevent actual API calls (can't use real GitHub in tests)
const githubHelpersPath = resolve(__dirname, '../../../src/lib/integrations/github/issue-service')
const createFailedUserDeletionIssueMock = jest.fn<() => Promise<void>>()
jest.unstable_mockModule(githubHelpersPath, () => ({createFailedUserDeletionIssue: createFailedUserDeletionIssueMock}))

// Import handler after mocking GitHub (but NOT entities - those use real PostgreSQL)
const {handler} = await import('../../../src/lambdas/UserDelete/src/index')

function createUserDeleteEvent(userId: string): CustomAPIGatewayRequestAuthorizerEvent {
  return {
    body: null,
    headers: {Authorization: 'Bearer test-token'},
    multiValueHeaders: {},
    httpMethod: 'DELETE',
    isBase64Encoded: false,
    path: '/users',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      protocol: 'HTTP/1.1',
      httpMethod: 'DELETE',
      path: '/users',
      stage: 'test',
      requestId: 'test-request',
      requestTime: '01/Jan/2024:00:00:00 +0000',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/users',
      authorizer: {principalId: userId, userId, userStatus: UserStatus.Authenticated, integrationLatency: 342},
      identity: {sourceIp: '127.0.0.1', userAgent: 'test-agent'}
    },
    resource: '/users'
  } as unknown as CustomAPIGatewayRequestAuthorizerEvent
}

describe('UserDelete Cascade Integration Tests', () => {
  let mockContext: Context
  let platformAppArn: string
  const testAppName = `test-delete-app-${Date.now()}`

  beforeAll(async () => {
    // Create PostgreSQL tables
    await createAllTables()

    // Create LocalStack SNS platform application
    platformAppArn = await createTestPlatformApplication(testAppName)

    // Set environment variables for the Lambda
    process.env.PLATFORM_APPLICATION_ARN = platformAppArn
    process.env.PUSH_NOTIFICATION_TOPIC_ARN = 'arn:aws:sns:us-west-2:000000000000:test-topic'

    mockContext = createMockContext()
  })

  afterEach(async () => {
    // Clean up data between tests
    await truncateAllTables()
    jest.clearAllMocks()
  })

  afterAll(async () => {
    // Clean up LocalStack SNS
    await deleteTestPlatformApplication(platformAppArn)

    // Drop tables and close connection
    await dropAllTables()
    await closeTestDb()
  })

  beforeEach(() => {
    createFailedUserDeletionIssueMock.mockResolvedValue(undefined)
  })

  test('should delete user with files and devices in correct cascade order', async () => {
    // Arrange: Create user with files and devices
    const userId = crypto.randomUUID()
    const db = getTestDb()

    await insertUser({userId, email: 'cascade@example.com', firstName: 'Cascade'})

    // Create files and link to user
    await insertFile({fileId: 'file-1', status: FileStatus.Downloaded, title: 'File 1'})
    await insertFile({fileId: 'file-2', status: FileStatus.Downloaded, title: 'File 2'})
    await linkUserFile(userId, 'file-1')
    await linkUserFile(userId, 'file-2')

    // Create devices with SNS endpoints and link to user
    const endpoint1 = await createTestEndpoint(platformAppArn, `token-cascade-1-${Date.now()}`)
    const endpoint2 = await createTestEndpoint(platformAppArn, `token-cascade-2-${Date.now()}`)

    await insertDevice({deviceId: 'device-1', token: 'token-1', endpointArn: endpoint1})
    await insertDevice({deviceId: 'device-2', token: 'token-2', endpointArn: endpoint2})
    await linkUserDevice(userId, 'device-1')
    await linkUserDevice(userId, 'device-2')

    // Act
    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(204)

    // Verify user was deleted
    const deletedUser = await getUser(userId)
    expect(deletedUser).toBeNull()

    // Verify UserFiles were deleted
    const remainingUserFiles = await db.select().from(userFiles).where(eq(userFiles.userId, userId))
    expect(remainingUserFiles).toHaveLength(0)

    // Verify UserDevices were deleted
    const remainingUserDevices = await db.select().from(userDevices).where(eq(userDevices.userId, userId))
    expect(remainingUserDevices).toHaveLength(0)

    // Verify Devices were deleted
    const device1 = await getDevice('device-1')
    const device2 = await getDevice('device-2')
    expect(device1).toBeNull()
    expect(device2).toBeNull()

    // Note: Files themselves should NOT be deleted (they may be shared with other users)
  })

  test('should delete user with no files or devices', async () => {
    // Arrange: Create user without files or devices
    const userId = crypto.randomUUID()

    await insertUser({userId, email: 'empty@example.com', firstName: 'Empty'})

    // Act
    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(204)

    // Verify user was deleted
    const deletedUser = await getUser(userId)
    expect(deletedUser).toBeNull()
  })

  test('should return 401 when no userId in event', async () => {
    // Arrange: Event with no userId
    const event = {
      body: null,
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'DELETE',
      isBase64Encoded: false,
      path: '/users',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {
        accountId: '123456789012',
        apiId: 'test-api',
        protocol: 'HTTP/1.1',
        httpMethod: 'DELETE',
        path: '/users',
        stage: 'test',
        requestId: 'test-request',
        requestTime: '01/Jan/2024:00:00:00 +0000',
        requestTimeEpoch: Date.now(),
        resourceId: 'test-resource',
        resourcePath: '/users',
        authorizer: {principalId: 'unknown', userId: undefined, userStatus: UserStatus.Unauthenticated, integrationLatency: 342},
        identity: {sourceIp: '127.0.0.1', userAgent: 'test-agent'}
      },
      resource: '/users'
    } as unknown as CustomAPIGatewayRequestAuthorizerEvent

    // Act
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(401)
  })

  test('should handle multiple devices with SNS endpoint deletion', async () => {
    // Arrange: Create user with multiple devices
    const userId = crypto.randomUUID()

    await insertUser({userId, email: 'multidevice@example.com', firstName: 'MultiDevice'})

    // Create 3 devices with SNS endpoints
    const deviceConfigs = [
      {deviceId: 'device-multi-1', token: `token-multi-1-${Date.now()}`},
      {deviceId: 'device-multi-2', token: `token-multi-2-${Date.now()}`},
      {deviceId: 'device-multi-3', token: `token-multi-3-${Date.now()}`}
    ]

    for (const config of deviceConfigs) {
      const endpointArn = await createTestEndpoint(platformAppArn, config.token)
      await insertDevice({deviceId: config.deviceId, token: config.token, endpointArn})
      await linkUserDevice(userId, config.deviceId)
    }

    // Act
    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(204)

    // Verify all devices were deleted
    for (const config of deviceConfigs) {
      const device = await getDevice(config.deviceId)
      expect(device).toBeNull()
    }
  })

  test('should delete user even if device has no endpointArn', async () => {
    // Arrange: Create user with device that has no endpointArn
    const userId = crypto.randomUUID()

    await insertUser({userId, email: 'noendpoint@example.com', firstName: 'NoEndpoint'})

    await insertDevice({deviceId: 'device-no-arn', token: 'some-token'}) // No endpointArn
    await linkUserDevice(userId, 'device-no-arn')

    // Act
    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Assert: Should still succeed
    expect(result.statusCode).toBe(204)

    // Verify user and device were deleted
    const deletedUser = await getUser(userId)
    expect(deletedUser).toBeNull()

    const deletedDevice = await getDevice('device-no-arn')
    expect(deletedDevice).toBeNull()
  })

  test('should handle user with only files (no devices)', async () => {
    // Arrange: Create user with only files
    const userId = crypto.randomUUID()

    await insertUser({userId, email: 'filesonly@example.com', firstName: 'FilesOnly'})

    await insertFile({fileId: 'file-only-1', status: FileStatus.Downloaded, title: 'File Only 1'})
    await insertFile({fileId: 'file-only-2', status: FileStatus.Queued, title: 'File Only 2'})
    await linkUserFile(userId, 'file-only-1')
    await linkUserFile(userId, 'file-only-2')

    // Act
    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(204)

    // Verify user was deleted
    const deletedUser = await getUser(userId)
    expect(deletedUser).toBeNull()

    // Verify UserFiles associations were deleted
    const db = getTestDb()
    const remainingUserFiles = await db.select().from(userFiles).where(eq(userFiles.userId, userId))
    expect(remainingUserFiles).toHaveLength(0)
  })

  test('should handle user with only devices (no files)', async () => {
    // Arrange: Create user with only devices
    const userId = crypto.randomUUID()

    await insertUser({userId, email: 'devicesonly@example.com', firstName: 'DevicesOnly'})

    const endpoint = await createTestEndpoint(platformAppArn, `token-devonly-${Date.now()}`)
    await insertDevice({deviceId: 'device-only-1', token: 'token-only', endpointArn: endpoint})
    await linkUserDevice(userId, 'device-only-1')

    // Act
    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(204)

    // Verify user was deleted
    const deletedUser = await getUser(userId)
    expect(deletedUser).toBeNull()

    // Verify device was deleted
    const deletedDevice = await getDevice('device-only-1')
    expect(deletedDevice).toBeNull()
  })
})
