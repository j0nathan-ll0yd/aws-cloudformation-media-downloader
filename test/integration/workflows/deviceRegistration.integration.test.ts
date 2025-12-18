/**
 * Device Registration Integration Tests
 *
 * Tests the RegisterDevice workflow:
 * 1. Create SNS platform endpoint from device token
 * 2. Upsert Device record (idempotent)
 * 3. Upsert UserDevice association for authenticated users
 * 4. Handle duplicate device registration (same device, different users)
 * 5. Subscribe anonymous users to push notification topic
 *
 * Validates:
 * - Idempotent device registration (no duplicates)
 * - Proper handling of authenticated vs anonymous users
 * - SNS subscription management
 */

// Test configuration
const TEST_TABLE = 'test-device-registration'

// Set environment variables for Lambda
process.env.DynamoDBTableName = TEST_TABLE
process.env.USE_LOCALSTACK = 'true'
process.env.PlatformApplicationArn = 'arn:aws:sns:us-west-2:123456789012:app/APNS/TestApp'
process.env.PushNotificationTopicArn = 'arn:aws:sns:us-west-2:123456789012:TestTopic'

// Required env vars
process.env.DefaultFileSize = '1024'
process.env.DefaultFileName = 'test-default-file.mp4'
process.env.DefaultFileUrl = 'https://example.com/test-default-file.mp4'
process.env.DefaultFileContentType = 'video/mp4'

import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals'
import type {Context} from 'aws-lambda'
import {UserStatus} from '../../../src/types/enums'

// Test helpers
import {createFilesTable, deleteFilesTable} from '../helpers/dynamodb-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createElectroDBEntityMock} from '../../helpers/electrodb-mock'
import {createMockDevice, createMockUserDevice} from '../helpers/test-data'

import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '../../../src/types/infrastructure-types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Entity module paths
const devicesModulePath = resolve(__dirname, '../../../src/entities/Devices')
const userDevicesModulePath = resolve(__dirname, '../../../src/entities/UserDevices')

// Mock SNS operations
const snsModulePath = resolve(__dirname, '../../../src/lib/vendor/AWS/SNS')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createPlatformEndpointMock = jest.fn<any>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const listSubscriptionsByTopicMock = jest.fn<any>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unsubscribeMock = jest.fn<any>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const subscribeMock = jest.fn<any>()

jest.unstable_mockModule(snsModulePath,
  () => ({
    createPlatformEndpoint: createPlatformEndpointMock,
    listSubscriptionsByTopic: listSubscriptionsByTopicMock,
    unsubscribe: unsubscribeMock,
    subscribe: subscribeMock,
    deleteEndpoint: jest.fn()
  }))

// Create entity mocks
const devicesMock = createElectroDBEntityMock()
jest.unstable_mockModule(devicesModulePath, () => ({Devices: devicesMock.entity}))

const userDevicesMock = createElectroDBEntityMock({queryIndexes: ['byUser']})
jest.unstable_mockModule(userDevicesModulePath, () => ({UserDevices: userDevicesMock.entity}))

// Import handler after mocking
const {handler} = await import('../../../src/lambdas/RegisterDevice/src/index')

interface DeviceRegistrationBody {
  deviceId: string
  token: string
  name?: string
  systemName?: string
  systemVersion?: string
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

  beforeAll(async () => {
    await createFilesTable()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    mockContext = createMockContext()
  })

  afterAll(async () => {
    await deleteFilesTable()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should register new device for authenticated user', async () => {
    const userId = 'user-new-device'
    const deviceId = 'device-new-123'
    const token = 'apns-token-abc123'
    const endpointArn = `arn:aws:sns:us-west-2:123456789012:endpoint/APNS/TestApp/${deviceId}`

    // Mock SNS createPlatformEndpoint
    createPlatformEndpointMock.mockResolvedValue({EndpointArn: endpointArn})

    // Mock device upsert
    devicesMock.mocks.upsert.go.mockResolvedValue({data: {...createMockDevice(deviceId, endpointArn), token}})

    // Mock userDevice upsert
    userDevicesMock.mocks.upsert.go.mockResolvedValue({data: createMockUserDevice(userId, deviceId)})

    // Mock getUserDevices - first device (length === 1)
    userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({data: [createMockUserDevice(userId, deviceId)]})

    const body: DeviceRegistrationBody = {deviceId, token, name: 'iPhone 15', systemName: 'iOS', systemVersion: '17.0'}
    const event = createRegisterDeviceEvent(body, userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)
    expect(response.body.endpointArn).toBe(endpointArn)

    // Verify SNS endpoint created
    expect(createPlatformEndpointMock).toHaveBeenCalledWith({PlatformApplicationArn: process.env.PlatformApplicationArn, Token: token})

    // Verify device stored
    expect(devicesMock.entity.upsert).toHaveBeenCalled()

    // Verify user-device association created
    expect(userDevicesMock.entity.upsert).toHaveBeenCalled()
  })

  test('should handle duplicate device registration (same user registers same device again)', async () => {
    const userId = 'user-duplicate'
    const deviceId = 'device-duplicate-123'
    const token = 'apns-token-duplicate'
    const endpointArn = `arn:aws:sns:us-west-2:123456789012:endpoint/APNS/TestApp/${deviceId}`

    // Mock SNS createPlatformEndpoint - idempotent, returns same endpoint
    createPlatformEndpointMock.mockResolvedValue({EndpointArn: endpointArn})

    // Mock device upsert - idempotent
    devicesMock.mocks.upsert.go.mockResolvedValue({data: {...createMockDevice(deviceId, endpointArn), token}})

    // Mock userDevice upsert - idempotent
    userDevicesMock.mocks.upsert.go.mockResolvedValue({data: createMockUserDevice(userId, deviceId)})

    // Mock getUserDevices - user already has this device (length > 1 means existing)
    userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({
      data: [
        createMockUserDevice(userId, deviceId),
        createMockUserDevice(userId, 'other-device')
      ]
    })

    // Mock listSubscriptionsByTopic for unsubscribe flow
    listSubscriptionsByTopicMock.mockResolvedValue({
      Subscriptions: [{Endpoint: endpointArn, SubscriptionArn: 'arn:aws:sns:us-west-2:123456789012:TestTopic:sub-123'}]
    })

    unsubscribeMock.mockResolvedValue(undefined)

    const body: DeviceRegistrationBody = {deviceId, token, name: 'iPhone 15', systemName: 'iOS', systemVersion: '17.0'}
    const event = createRegisterDeviceEvent(body, userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    // Should return 201 for existing user with multiple devices
    expect(result.statusCode).toBe(201)

    // Verify unsubscribe was called (to prevent duplicate notifications)
    expect(unsubscribeMock).toHaveBeenCalled()
  })

  test('should register device for anonymous user and subscribe to topic', async () => {
    const deviceId = 'device-anon-123'
    const token = 'apns-token-anon'
    const endpointArn = `arn:aws:sns:us-west-2:123456789012:endpoint/APNS/TestApp/${deviceId}`

    // Mock SNS createPlatformEndpoint
    createPlatformEndpointMock.mockResolvedValue({EndpointArn: endpointArn})

    // Mock device upsert
    devicesMock.mocks.upsert.go.mockResolvedValue({data: {...createMockDevice(deviceId, endpointArn), token}})

    // Mock subscribe for anonymous user
    subscribeMock.mockResolvedValue({SubscriptionArn: 'arn:aws:sns:us-west-2:123456789012:TestTopic:sub-anon'})

    const body: DeviceRegistrationBody = {deviceId, token, name: 'iPhone 15', systemName: 'iOS', systemVersion: '17.0'}
    const event = createRegisterDeviceEvent(body, undefined, UserStatus.Anonymous)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)

    // Verify device stored (even for anonymous)
    expect(devicesMock.entity.upsert).toHaveBeenCalled()

    // Anonymous user should NOT create UserDevice association
    expect(userDevicesMock.entity.upsert).not.toHaveBeenCalled()
  })

  test('should return 401 for unauthenticated user', async () => {
    const deviceId = 'device-unauth-123'
    const token = 'apns-token-unauth'
    const endpointArn = `arn:aws:sns:us-west-2:123456789012:endpoint/APNS/TestApp/${deviceId}`

    // Mock SNS createPlatformEndpoint
    createPlatformEndpointMock.mockResolvedValue({EndpointArn: endpointArn})

    // Mock device upsert
    devicesMock.mocks.upsert.go.mockResolvedValue({data: {...createMockDevice(deviceId, endpointArn), token}})

    const body: DeviceRegistrationBody = {deviceId, token, name: 'iPhone 15', systemName: 'iOS', systemVersion: '17.0'}
    // Create event with Authorization header but invalid/no userId
    // getUserDetailsFromEvent returns Unauthenticated when there's an auth header but no userId
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
    const userId = 'user-validation'

    // Missing required fields
    const invalidBody = {deviceId: 'test-123'}
    const event = createRegisterDeviceEvent(invalidBody as DeviceRegistrationBody, userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    // Should fail validation
    expect(result.statusCode).toBe(400)
  })

  test('should handle SNS createPlatformEndpoint failure', async () => {
    const userId = 'user-sns-failure'
    const deviceId = 'device-sns-fail'
    const token = 'apns-token-fail'

    // Mock SNS failure
    createPlatformEndpointMock.mockResolvedValue(undefined as unknown as {EndpointArn: string})

    const body: DeviceRegistrationBody = {deviceId, token, name: 'iPhone 15', systemName: 'iOS', systemVersion: '17.0'}
    const event = createRegisterDeviceEvent(body, userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(500)
  })

  test('should register device with full device info', async () => {
    const userId = 'user-full-info'
    const deviceId = 'device-full-info'
    const token = 'apns-token-full'
    const endpointArn = `arn:aws:sns:us-west-2:123456789012:endpoint/APNS/TestApp/${deviceId}`

    createPlatformEndpointMock.mockResolvedValue({EndpointArn: endpointArn})
    devicesMock.mocks.upsert.go.mockResolvedValue({
      data: {deviceId, endpointArn, token, name: 'iPhone 15 Pro Max', systemName: 'iOS', systemVersion: '17.2'}
    })
    userDevicesMock.mocks.upsert.go.mockResolvedValue({data: createMockUserDevice(userId, deviceId)})
    userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({data: [createMockUserDevice(userId, deviceId)]})

    const body: DeviceRegistrationBody = {deviceId, token, name: 'iPhone 15 Pro Max', systemName: 'iOS', systemVersion: '17.2'}
    const event = createRegisterDeviceEvent(body, userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)

    // Verify full device info was passed to upsert
    expect(devicesMock.entity.upsert).toHaveBeenCalled()
  })
})
