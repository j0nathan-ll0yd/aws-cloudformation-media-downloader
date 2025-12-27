/**
 * Device Registration Integration Tests
 *
 * Tests the RegisterDevice workflow against real services:
 * - PostgreSQL: Device and UserDevice records
 * - LocalStack SNS: Platform application and endpoints
 *
 * Workflow:
 * 1. Create SNS platform endpoint from device token
 * 2. Upsert Device record (idempotent)
 * 3. Upsert UserDevice association for authenticated users
 * 4. Handle duplicate device registration (same device, different users)
 * 5. Subscribe anonymous users to push notification topic
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'
process.env.DEFAULT_FILE_SIZE = '1024'
process.env.DEFAULT_FILE_NAME = 'test-default-file.mp4'
process.env.DEFAULT_FILE_URL = 'https://example.com/test-default-file.mp4'
process.env.DEFAULT_FILE_CONTENT_TYPE = 'video/mp4'

import {afterAll, afterEach, beforeAll, describe, expect, test} from '@jest/globals'
import type {Context} from 'aws-lambda'
import {UserStatus} from '../../../src/types/enums'

// Test helpers
import {
  closeTestDb,
  createAllTables,
  dropAllTables,
  getDevice,
  getTestDb,
  insertUser,
  truncateAllTables
} from '../helpers/postgres-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {
  createTestPlatformApplication,
  createTestTopic,
  deleteTestPlatformApplication,
  deleteTestTopic,
  listTestEndpoints
} from '../helpers/sns-helpers'
import {userDevices} from '#lib/vendor/Drizzle/schema'
import {eq} from 'drizzle-orm'

import type {CustomAPIGatewayRequestAuthorizerEvent} from '../../../src/types/infrastructure-types'

// Import handler directly (no mocking - uses real services)
const {handler} = await import('../../../src/lambdas/RegisterDevice/src/index')

interface DeviceRegistrationBody {
  deviceId: string
  token: string
  name: string
  systemName: string
  systemVersion: string
}

function createDeviceBody(deviceId: string, token: string): DeviceRegistrationBody {
  return {deviceId, token, name: 'Test Device', systemName: 'iOS', systemVersion: '17.0'}
}

function createRegisterDeviceEvent(
  body: DeviceRegistrationBody,
  userId: string | undefined,
  userStatus: UserStatus
): CustomAPIGatewayRequestAuthorizerEvent {
  return {
    body: JSON.stringify(body),
    headers: userId ? {Authorization: 'Bearer test-token'} : {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/devices',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      protocol: 'HTTP/1.1',
      httpMethod: 'POST',
      path: '/devices',
      stage: 'test',
      requestId: 'test-request',
      requestTime: '01/Jan/2024:00:00:00 +0000',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/devices',
      authorizer: {
        principalId: userStatus === UserStatus.Unauthenticated ? 'unknown' : userId || 'anonymous',
        userId,
        userStatus,
        integrationLatency: 342
      },
      identity: {sourceIp: '127.0.0.1', userAgent: 'test-agent'}
    },
    resource: '/devices'
  } as unknown as CustomAPIGatewayRequestAuthorizerEvent
}

describe('Device Registration Integration Tests', () => {
  let mockContext: Context
  let platformAppArn: string
  let topicArn: string
  const testAppName = `test-register-app-${Date.now()}`
  const testTopicName = `test-register-topic-${Date.now()}`

  beforeAll(async () => {
    // Create PostgreSQL tables
    await createAllTables()

    // Create LocalStack SNS resources
    platformAppArn = await createTestPlatformApplication(testAppName)
    topicArn = await createTestTopic(testTopicName)

    // Set environment variables for the Lambda
    process.env.PLATFORM_APPLICATION_ARN = platformAppArn
    process.env.PUSH_NOTIFICATION_TOPIC_ARN = topicArn

    mockContext = createMockContext()
  })

  afterEach(async () => {
    // Clean up data between tests
    await truncateAllTables()
  })

  afterAll(async () => {
    // Clean up LocalStack SNS
    await deleteTestPlatformApplication(platformAppArn)
    await deleteTestTopic(topicArn)

    // Drop tables and close connection
    await dropAllTables()
    await closeTestDb()
  })

  test('should register new device for authenticated user', async () => {
    const userId = crypto.randomUUID()
    const deviceId = `device-new-${Date.now()}`
    const token = `apns-token-${Date.now()}`

    // Create user in PostgreSQL
    await insertUser({userId, email: 'newdevice@example.com', firstName: 'NewDevice'})

    const body = createDeviceBody(deviceId, token)
    const event = createRegisterDeviceEvent(body, userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)
    expect(response.body.endpointArn).toContain('arn:aws:sns')

    // Verify device was created in PostgreSQL
    const device = await getDevice(deviceId)
    expect(device).not.toBeNull()
    expect(device?.token).toBe(token)
    expect(device?.endpointArn).toContain('arn:aws:sns')

    // Verify UserDevice association was created
    const db = getTestDb()
    const associations = await db.select().from(userDevices).where(eq(userDevices.userId, userId))
    expect(associations).toHaveLength(1)
    expect(associations[0].deviceId).toBe(deviceId)

    // Verify SNS endpoint was created in LocalStack
    const endpoints = await listTestEndpoints(platformAppArn)
    expect(endpoints.length).toBeGreaterThan(0)
  })

  test('should handle duplicate device registration (idempotent)', async () => {
    const userId = crypto.randomUUID()
    const deviceId = `device-dup-${Date.now()}`
    const token = `apns-token-dup-${Date.now()}`

    await insertUser({userId, email: 'duplicate@example.com', firstName: 'Duplicate'})

    const body = createDeviceBody(deviceId, token)
    const event = createRegisterDeviceEvent(body, userId, UserStatus.Authenticated)

    // Register device twice
    const result1 = await handler(event, mockContext)
    expect(result1.statusCode).toBe(200)

    const result2 = await handler(event, mockContext)
    // Second registration should return 201 (existing user with device)
    expect([200, 201]).toContain(result2.statusCode)

    // Should still have only one device record
    const device = await getDevice(deviceId)
    expect(device).not.toBeNull()

    // Should still have only one UserDevice association
    const db = getTestDb()
    const associations = await db.select().from(userDevices).where(eq(userDevices.userId, userId))
    expect(associations).toHaveLength(1)
  })

  test('should register device for anonymous user', async () => {
    const deviceId = `device-anon-${Date.now()}`
    const token = `apns-token-anon-${Date.now()}`

    const body = createDeviceBody(deviceId, token)
    const event = createRegisterDeviceEvent(body, undefined, UserStatus.Anonymous)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)

    // Device should be created
    const device = await getDevice(deviceId)
    expect(device).not.toBeNull()
    expect(device?.endpointArn).toContain('arn:aws:sns')

    // No UserDevice association for anonymous
    const db = getTestDb()
    const associations = await db.select().from(userDevices).where(eq(userDevices.deviceId, deviceId))
    expect(associations).toHaveLength(0)
  })

  test('should return 401 for unauthenticated user', async () => {
    const deviceId = `device-unauth-${Date.now()}`
    const token = `apns-token-unauth-${Date.now()}`

    const body = createDeviceBody(deviceId, token)
    const event = {
      body: JSON.stringify(body),
      headers: {Authorization: 'Bearer invalid-token'},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/devices',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {
        accountId: '123456789012',
        apiId: 'test-api',
        protocol: 'HTTP/1.1',
        httpMethod: 'POST',
        path: '/devices',
        stage: 'test',
        requestId: 'test-request',
        requestTime: '01/Jan/2024:00:00:00 +0000',
        requestTimeEpoch: Date.now(),
        resourceId: 'test-resource',
        resourcePath: '/devices',
        authorizer: {
          principalId: 'unknown',
          userId: undefined,
          userStatus: UserStatus.Unauthenticated,
          integrationLatency: 342
        },
        identity: {sourceIp: '127.0.0.1', userAgent: 'test-agent'}
      },
      resource: '/devices'
    } as unknown as CustomAPIGatewayRequestAuthorizerEvent

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(401)
  })

  test('should validate request body schema', async () => {
    const userId = crypto.randomUUID()
    await insertUser({userId, email: 'validation@example.com', firstName: 'Validation'})

    // Missing required fields
    const invalidBody = {deviceId: 'test-123'} as DeviceRegistrationBody
    const event = createRegisterDeviceEvent(invalidBody, userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(400)
  })

  test('should register device with full device info', async () => {
    const userId = crypto.randomUUID()
    const deviceId = `device-full-${Date.now()}`
    const token = `apns-token-full-${Date.now()}`

    await insertUser({userId, email: 'fullinfo@example.com', firstName: 'FullInfo'})

    const body: DeviceRegistrationBody = {
      deviceId,
      token,
      name: 'iPhone 15 Pro Max',
      systemName: 'iOS',
      systemVersion: '17.2'
    }
    const event = createRegisterDeviceEvent(body, userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)

    // Verify full device info was stored
    const device = await getDevice(deviceId)
    expect(device?.name).toBe('iPhone 15 Pro Max')
    expect(device?.systemName).toBe('iOS')
    expect(device?.systemVersion).toBe('17.2')
  })

  test('should allow multiple users to register same device', async () => {
    const user1Id = crypto.randomUUID()
    const user2Id = crypto.randomUUID()
    const deviceId = `device-shared-${Date.now()}`
    const token = `apns-token-shared-${Date.now()}`

    await insertUser({userId: user1Id, email: 'user1@example.com', firstName: 'User1'})
    await insertUser({userId: user2Id, email: 'user2@example.com', firstName: 'User2'})

    const body = createDeviceBody(deviceId, token)

    // User 1 registers device
    const event1 = createRegisterDeviceEvent(body, user1Id, UserStatus.Authenticated)
    const result1 = await handler(event1, mockContext)
    expect(result1.statusCode).toBe(200)

    // User 2 registers same device
    const event2 = createRegisterDeviceEvent(body, user2Id, UserStatus.Authenticated)
    const result2 = await handler(event2, mockContext)
    expect(result2.statusCode).toBe(200)

    // Both users should have association to the device
    const db = getTestDb()
    const associations = await db.select().from(userDevices).where(eq(userDevices.deviceId, deviceId))
    expect(associations).toHaveLength(2)
  })
})
