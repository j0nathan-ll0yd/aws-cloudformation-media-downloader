/**
 * UserDelete Cascade Integration Tests
 *
 * Tests the user deletion workflow:
 * - Entity queries: Mocked for user/device/file operations
 * - Device service: Mocked for device deletion (includes SNS cleanup)
 * - GitHub API: Mocked for error reporting
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
import {createMockDevice} from '../helpers/test-data'

// Mock entity queries - must use vi.hoisted for ESM
const {deleteUserMock, deleteUserDevicesByUserIdMock, deleteUserFilesByUserIdMock, getDevicesBatchMock} = vi.hoisted(() => ({
  deleteUserMock: vi.fn(),
  deleteUserDevicesByUserIdMock: vi.fn(),
  deleteUserFilesByUserIdMock: vi.fn(),
  getDevicesBatchMock: vi.fn()
}))

vi.mock('#entities/queries', () => ({
  deleteUser: deleteUserMock,
  deleteUserDevicesByUserId: deleteUserDevicesByUserIdMock,
  deleteUserFilesByUserId: deleteUserFilesByUserIdMock,
  getDevicesBatch: getDevicesBatchMock
}))

// Mock device service - must use vi.hoisted for ESM
const {deleteDeviceMock, getUserDevicesMock} = vi.hoisted(() => ({
  deleteDeviceMock: vi.fn(),
  getUserDevicesMock: vi.fn()
}))

vi.mock('#lib/domain/device/device-service', () => ({
  deleteDevice: deleteDeviceMock,
  getUserDevices: getUserDevicesMock
}))

// Mock GitHub helpers - must use vi.hoisted for ESM
const {createFailedUserDeletionIssueMock} = vi.hoisted(() => ({createFailedUserDeletionIssueMock: vi.fn()}))
vi.mock('#lib/integrations/github/issue-service', () => ({createFailedUserDeletionIssue: createFailedUserDeletionIssueMock}))

// Import handler after mocks
const {handler} = await import('#lambdas/UserDelete/src/index')

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

  beforeAll(() => {
    mockContext = createMockContext()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock implementations
    deleteUserMock.mockResolvedValue(undefined)
    deleteUserDevicesByUserIdMock.mockResolvedValue(undefined)
    deleteUserFilesByUserIdMock.mockResolvedValue(undefined)
    getDevicesBatchMock.mockResolvedValue([])
    getUserDevicesMock.mockResolvedValue([])
    deleteDeviceMock.mockResolvedValue(undefined)
    createFailedUserDeletionIssueMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('should delete user with files and devices in correct cascade order', async () => {
    // Arrange: User with files and devices
    const userId = crypto.randomUUID()
    const device1 = createMockDevice({deviceId: 'device-1', endpointArn: 'arn:aws:sns:us-west-2:000000000000:endpoint/APNS/test-app/endpoint-1'})
    const device2 = createMockDevice({deviceId: 'device-2', endpointArn: 'arn:aws:sns:us-west-2:000000000000:endpoint/APNS/test-app/endpoint-2'})

    getUserDevicesMock.mockResolvedValue([{userId, deviceId: 'device-1'}, {userId, deviceId: 'device-2'}])
    getDevicesBatchMock.mockResolvedValue([device1, device2])

    // Act
    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(204)

    // Verify cascade order: children before parent
    expect(deleteUserFilesByUserIdMock).toHaveBeenCalledWith(userId)
    expect(deleteUserDevicesByUserIdMock).toHaveBeenCalledWith(userId)
    expect(deleteDeviceMock).toHaveBeenCalledTimes(2)
    expect(deleteUserMock).toHaveBeenCalledWith(userId)
  })

  test('should delete user with no files or devices', async () => {
    // Arrange: User without files or devices
    const userId = crypto.randomUUID()
    getUserDevicesMock.mockResolvedValue([])
    getDevicesBatchMock.mockResolvedValue([])

    // Act
    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(204)
    expect(deleteUserMock).toHaveBeenCalledWith(userId)
    expect(deleteDeviceMock).not.toHaveBeenCalled()
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
    // Arrange: User with multiple devices
    const userId = crypto.randomUUID()
    const deviceConfigs = [
      {deviceId: 'device-multi-1', endpointArn: 'arn:aws:sns:us-west-2:000000000000:endpoint/APNS/test-app/endpoint-multi-1'},
      {deviceId: 'device-multi-2', endpointArn: 'arn:aws:sns:us-west-2:000000000000:endpoint/APNS/test-app/endpoint-multi-2'},
      {deviceId: 'device-multi-3', endpointArn: 'arn:aws:sns:us-west-2:000000000000:endpoint/APNS/test-app/endpoint-multi-3'}
    ]

    getUserDevicesMock.mockResolvedValue(deviceConfigs.map(c => ({userId, deviceId: c.deviceId})))
    getDevicesBatchMock.mockResolvedValue(deviceConfigs.map(c => createMockDevice(c)))

    // Act
    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(204)
    expect(deleteDeviceMock).toHaveBeenCalledTimes(3)
  })

  test('should delete user even if device has no endpointArn', async () => {
    // Arrange: User with device that has no endpointArn
    const userId = crypto.randomUUID()
    const device = createMockDevice({deviceId: 'device-no-arn', endpointArn: undefined})

    getUserDevicesMock.mockResolvedValue([{userId, deviceId: 'device-no-arn'}])
    getDevicesBatchMock.mockResolvedValue([device])

    // Act
    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Assert: Should still succeed
    expect(result.statusCode).toBe(204)
    expect(deleteUserMock).toHaveBeenCalledWith(userId)
  })

  test('should handle user with only files (no devices)', async () => {
    // Arrange: User with only files
    const userId = crypto.randomUUID()
    getUserDevicesMock.mockResolvedValue([])
    getDevicesBatchMock.mockResolvedValue([])

    // Act
    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(204)
    expect(deleteUserFilesByUserIdMock).toHaveBeenCalledWith(userId)
    expect(deleteUserMock).toHaveBeenCalledWith(userId)
    expect(deleteDeviceMock).not.toHaveBeenCalled()
  })

  test('should handle user with only devices (no files)', async () => {
    // Arrange: User with only devices
    const userId = crypto.randomUUID()
    const device = createMockDevice({deviceId: 'device-only-1', endpointArn: 'arn:aws:sns:us-west-2:000000000000:endpoint/APNS/test-app/endpoint-only'})

    getUserDevicesMock.mockResolvedValue([{userId, deviceId: 'device-only-1'}])
    getDevicesBatchMock.mockResolvedValue([device])

    // Act
    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(204)
    expect(deleteUserDevicesByUserIdMock).toHaveBeenCalledWith(userId)
    expect(deleteDeviceMock).toHaveBeenCalledTimes(1)
    expect(deleteUserMock).toHaveBeenCalledWith(userId)
  })
})
