/**
 * Device Registration Integration Tests
 *
 * Tests the RegisterDevice workflow:
 * - Entity queries: Mocked for device operations
 * - SNS: Mocked for platform endpoints
 * - Device service: Mocked for user device lookup
 *
 * Workflow:
 * 1. Create SNS platform endpoint from device token (mocked)
 * 2. Upsert Device record (mocked)
 * 3. Upsert UserDevice association for authenticated users (mocked)
 * 4. Handle duplicate device registration (same device, different users)
 * 5. Subscribe anonymous users to push notification topic
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.DEFAULT_FILE_SIZE = '1024'
process.env.DEFAULT_FILE_NAME = 'test-default-file.mp4'
process.env.DEFAULT_FILE_URL = 'https://example.com/test-default-file.mp4'
process.env.DEFAULT_FILE_CONTENT_TYPE = 'video/mp4'
process.env.PLATFORM_APPLICATION_ARN = 'arn:aws:sns:us-west-2:000000000000:app/APNS/test-app'
process.env.PUSH_NOTIFICATION_TOPIC_ARN = 'arn:aws:sns:us-west-2:000000000000:test-topic'

import {afterEach, beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'
import type {Context} from 'aws-lambda'
import {UserStatus} from '#types/enums'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'

// Test helpers
import {createMockContext} from '../helpers/lambda-context'

// Mock entity queries - must use vi.hoisted for ESM
const {upsertDeviceMock, upsertUserDeviceMock} = vi.hoisted(() => ({
  upsertDeviceMock: vi.fn(),
  upsertUserDeviceMock: vi.fn()
}))

vi.mock('#entities/queries', () => ({
  upsertDevice: upsertDeviceMock,
  upsertUserDevice: upsertUserDeviceMock
}))

// Mock SNS vendor - must use vi.hoisted for ESM
const {createPlatformEndpointMock, listSubscriptionsByTopicMock} = vi.hoisted(() => ({
  createPlatformEndpointMock: vi.fn(),
  listSubscriptionsByTopicMock: vi.fn()
}))

vi.mock('#lib/vendor/AWS/SNS', () => ({
  createPlatformEndpoint: createPlatformEndpointMock,
  listSubscriptionsByTopic: listSubscriptionsByTopicMock
}))

// Mock device service - must use vi.hoisted for ESM
const {getUserDevicesMock, subscribeEndpointToTopicMock, unsubscribeEndpointToTopicMock} = vi.hoisted(() => ({
  getUserDevicesMock: vi.fn(),
  subscribeEndpointToTopicMock: vi.fn(),
  unsubscribeEndpointToTopicMock: vi.fn()
}))

vi.mock('#lib/domain/device/device-service', () => ({
  getUserDevices: getUserDevicesMock,
  subscribeEndpointToTopic: subscribeEndpointToTopicMock,
  unsubscribeEndpointToTopic: unsubscribeEndpointToTopicMock
}))

// Import handler after mocks
const {handler} = await import('#lambdas/RegisterDevice/src/index')

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
      authorizer: {principalId: userStatus === UserStatus.Unauthenticated ? 'unknown' : userId || 'anonymous', userId, userStatus, integrationLatency: 342},
      identity: {sourceIp: '127.0.0.1', userAgent: 'test-agent'}
    },
    resource: '/devices'
  } as unknown as CustomAPIGatewayRequestAuthorizerEvent
}

describe('Device Registration Integration Tests', () => {
  let mockContext: Context

  beforeAll(() => {
    mockContext = createMockContext()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock implementations
    createPlatformEndpointMock.mockResolvedValue({EndpointArn: 'arn:aws:sns:us-west-2:000000000000:endpoint/APNS/test-app/test-endpoint'})
    listSubscriptionsByTopicMock.mockResolvedValue({Subscriptions: []})
    upsertDeviceMock.mockResolvedValue(undefined)
    upsertUserDeviceMock.mockResolvedValue(undefined)
    getUserDevicesMock.mockResolvedValue([]) // Default: user has no devices yet
    subscribeEndpointToTopicMock.mockResolvedValue(undefined)
    unsubscribeEndpointToTopicMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('should register new device for authenticated user', async () => {
    const userId = crypto.randomUUID()
    const deviceId = `device-new-${Date.now()}`
    const token = `apns-token-${Date.now()}`

    // Mock: user has this as their first device
    getUserDevicesMock.mockResolvedValue([{userId, deviceId}])

    const body = createDeviceBody(deviceId, token)
    const event = createRegisterDeviceEvent(body, userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)
    expect(response.body.endpointArn).toContain('arn:aws:sns')

    // Verify entity queries were called
    expect(upsertDeviceMock).toHaveBeenCalledWith(expect.objectContaining({deviceId, token}))
    expect(upsertUserDeviceMock).toHaveBeenCalledWith({userId, deviceId})

    // Verify SNS endpoint was created
    expect(createPlatformEndpointMock).toHaveBeenCalledWith(expect.objectContaining({Token: token}))
  })

  test('should handle duplicate device registration (idempotent)', async () => {
    const userId = crypto.randomUUID()
    const deviceId = `device-dup-${Date.now()}`
    const token = `apns-token-dup-${Date.now()}`
    const endpointArn = 'arn:aws:sns:us-west-2:000000000000:endpoint/APNS/test-app/test-endpoint'

    // Mock: user already has devices (this is a re-registration)
    getUserDevicesMock.mockResolvedValue([{userId, deviceId}, {userId, deviceId: 'other-device'}])
    listSubscriptionsByTopicMock.mockResolvedValue({
      Subscriptions: [{Endpoint: endpointArn, SubscriptionArn: 'arn:aws:sns:us-west-2:000000000000:subscription/123'}]
    })

    const body = createDeviceBody(deviceId, token)
    const event = createRegisterDeviceEvent(body, userId, UserStatus.Authenticated)

    // Register device
    const result = await handler(event, mockContext)
    expect(result.statusCode).toBe(201)

    // Verify unsubscribe was called (user has multiple devices)
    expect(unsubscribeEndpointToTopicMock).toHaveBeenCalled()
  })

  test('should register device for anonymous user', async () => {
    const deviceId = `device-anon-${Date.now()}`
    const token = `apns-token-anon-${Date.now()}`

    const body = createDeviceBody(deviceId, token)
    const event = createRegisterDeviceEvent(body, undefined, UserStatus.Anonymous)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)

    // Device should be created but no UserDevice association
    expect(upsertDeviceMock).toHaveBeenCalled()
    expect(upsertUserDeviceMock).not.toHaveBeenCalled()

    // Anonymous user should be subscribed to topic
    expect(subscribeEndpointToTopicMock).toHaveBeenCalled()
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
        authorizer: {principalId: 'unknown', userId: undefined, userStatus: UserStatus.Unauthenticated, integrationLatency: 342},
        identity: {sourceIp: '127.0.0.1', userAgent: 'test-agent'}
      },
      resource: '/devices'
    } as unknown as CustomAPIGatewayRequestAuthorizerEvent

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(401)
  })

  test('should validate request body schema', async () => {
    const userId = crypto.randomUUID()

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

    // Mock: user has this as their first device
    getUserDevicesMock.mockResolvedValue([{userId, deviceId}])

    const body: DeviceRegistrationBody = {deviceId, token, name: 'iPhone 15 Pro Max', systemName: 'iOS', systemVersion: '17.2'}
    const event = createRegisterDeviceEvent(body, userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)

    // Verify full device info was passed to upsert
    expect(upsertDeviceMock).toHaveBeenCalledWith(expect.objectContaining({
      deviceId,
      token,
      name: 'iPhone 15 Pro Max',
      systemName: 'iOS',
      systemVersion: '17.2'
    }))
  })

  test('should allow multiple users to register same device', async () => {
    const user1Id = crypto.randomUUID()
    const user2Id = crypto.randomUUID()
    const deviceId = `device-shared-${Date.now()}`
    const token = `apns-token-shared-${Date.now()}`

    const body = createDeviceBody(deviceId, token)

    // User 1 registers device (first device)
    getUserDevicesMock.mockResolvedValueOnce([{userId: user1Id, deviceId}])
    const event1 = createRegisterDeviceEvent(body, user1Id, UserStatus.Authenticated)
    const result1 = await handler(event1, mockContext)
    expect(result1.statusCode).toBe(200)

    // User 2 registers same device (first device for them too)
    getUserDevicesMock.mockResolvedValueOnce([{userId: user2Id, deviceId}])
    const event2 = createRegisterDeviceEvent(body, user2Id, UserStatus.Authenticated)
    const result2 = await handler(event2, mockContext)
    expect(result2.statusCode).toBe(200)

    // Both user associations should be created
    expect(upsertUserDeviceMock).toHaveBeenCalledWith({userId: user1Id, deviceId})
    expect(upsertUserDeviceMock).toHaveBeenCalledWith({userId: user2Id, deviceId})
    expect(upsertUserDeviceMock).toHaveBeenCalledTimes(2)
  })
})
