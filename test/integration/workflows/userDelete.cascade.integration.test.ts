/**
 * UserDelete Cascade Integration Tests
 *
 * Tests the user deletion workflow with cascade deletion:
 * 1. Delete UserFiles (user-file associations)
 * 2. Delete UserDevices (user-device associations)
 * 3. Delete Devices
 * 4. Delete User (parent - only after all children succeed)
 *
 * Validates:
 * - Correct cascade order (children before parent)
 * - Partial failure handling (don't delete parent if children fail)
 * - Error reporting via GitHub issue creation
 */

// Test configuration
const TEST_TABLE = 'test-user-delete'

// Set environment variables for Lambda
process.env.DynamoDBTableName = TEST_TABLE
process.env.USE_LOCALSTACK = 'true'

// Required env vars
process.env.DefaultFileSize = '1024'
process.env.DefaultFileName = 'test-default-file.mp4'
process.env.DefaultFileUrl = 'https://example.com/test-default-file.mp4'
process.env.DefaultFileContentType = 'video/mp4'
process.env.PlatformApplicationArn = 'arn:aws:sns:us-west-2:123456789012:app/APNS/TestApp'
process.env.PushNotificationTopicArn = 'arn:aws:sns:us-west-2:123456789012:TestTopic'

import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals'
import type {Context} from 'aws-lambda'
import {UserStatus} from '../../../src/types/enums'

// Test helpers
import {createFilesTable, deleteFilesTable} from '../helpers/dynamodb-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createElectroDBEntityMock} from '../../helpers/electrodb-mock'
import {createMockDevice, createMockUserDevice, createMockUserFile} from '../helpers/test-data'

import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'
import {CustomAPIGatewayRequestAuthorizerEvent} from '../../../src/types/infrastructure-types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Entity module paths
const usersModulePath = resolve(__dirname, '../../../src/entities/Users')
const userFilesModulePath = resolve(__dirname, '../../../src/entities/UserFiles')
const userDevicesModulePath = resolve(__dirname, '../../../src/entities/UserDevices')
const devicesModulePath = resolve(__dirname, '../../../src/entities/Devices')

// Mock GitHub helpers to prevent actual API calls
const githubHelpersPath = resolve(__dirname, '../../../src/util/github-helpers')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createFailedUserDeletionIssueMock = jest.fn<any>()
jest.unstable_mockModule(githubHelpersPath, () => ({
  createFailedUserDeletionIssue: createFailedUserDeletionIssueMock
}))

// Mock SNS operations (for device deletion)
const snsModulePath = resolve(__dirname, '../../../src/lib/vendor/AWS/SNS')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deleteEndpointMock = jest.fn<any>()
jest.unstable_mockModule(snsModulePath, () => ({
  deleteEndpoint: deleteEndpointMock,
  createPlatformEndpoint: jest.fn(),
  listSubscriptionsByTopic: jest.fn(),
  unsubscribe: jest.fn(),
  subscribe: jest.fn(),
  publishSnsEvent: jest.fn()
}))

// Create entity mocks
const usersMock = createElectroDBEntityMock()
jest.unstable_mockModule(usersModulePath, () => ({Users: usersMock.entity}))

const userFilesMock = createElectroDBEntityMock({queryIndexes: ['byUser']})
jest.unstable_mockModule(userFilesModulePath, () => ({UserFiles: userFilesMock.entity}))

const userDevicesMock = createElectroDBEntityMock({queryIndexes: ['byUser']})
jest.unstable_mockModule(userDevicesModulePath, () => ({UserDevices: userDevicesMock.entity}))

const devicesMock = createElectroDBEntityMock()
jest.unstable_mockModule(devicesModulePath, () => ({Devices: devicesMock.entity}))

// Import handler after mocking
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
      authorizer: {
        principalId: userId,
        userId,
        userStatus: UserStatus.Authenticated,
        integrationLatency: 342
      },
      identity: {sourceIp: '127.0.0.1', userAgent: 'test-agent'}
    },
    resource: '/users'
  } as unknown as CustomAPIGatewayRequestAuthorizerEvent
}

describe('UserDelete Cascade Integration Tests', () => {
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
    // Default mock implementations
    deleteEndpointMock.mockResolvedValue(undefined)
  })

  test('should delete user with files, devices in correct cascade order', async () => {
    const userId = 'user-cascade-test'
    const fileIds = ['file-1', 'file-2']
    const deviceIds = ['device-1', 'device-2']

    // Mock UserDevices query - returns user's device associations
    userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({
      data: deviceIds.map((deviceId) => createMockUserDevice(userId, deviceId))
    })

    // Mock Devices.get batch - returns actual device records
    devicesMock.mocks.get.mockResolvedValue({
      data: deviceIds.map((deviceId) => createMockDevice(deviceId)),
      unprocessed: []
    })

    // Mock UserFiles query
    userFilesMock.mocks.query.byUser!.go.mockResolvedValue({
      data: fileIds.map((fileId) => createMockUserFile(userId, fileId))
    })

    // Mock delete operations
    userFilesMock.mocks.delete.mockResolvedValue({unprocessed: []})
    userDevicesMock.mocks.delete.mockResolvedValue({unprocessed: []})
    devicesMock.mocks.delete.mockResolvedValue({unprocessed: []})
    usersMock.mocks.delete.mockResolvedValue(undefined)

    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(204)

    // Verify cascade order: UserFiles queried
    expect(userFilesMock.mocks.query.byUser!.go).toHaveBeenCalledTimes(1)

    // Verify UserDevices queried (getUserDevices + deleteUserDevices = 2 calls)
    expect(userDevicesMock.mocks.query.byUser!.go).toHaveBeenCalledTimes(2)

    // Verify Devices batch get called
    expect(devicesMock.mocks.get).toHaveBeenCalledTimes(1)

    // Verify user deleted last (after all children)
    expect(usersMock.entity.delete).toHaveBeenCalledWith({userId})
  })

  test('should return 207 partial failure when child deletion fails', async () => {
    const userId = 'user-partial-failure'

    // Mock UserDevices query
    userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({
      data: [createMockUserDevice(userId, 'device-1')]
    })

    // Mock Devices.get batch
    devicesMock.mocks.get.mockResolvedValue({
      data: [createMockDevice('device-1')],
      unprocessed: []
    })

    // Mock UserFiles query - simulate failure
    userFilesMock.mocks.query.byUser!.go.mockRejectedValue(new Error('DynamoDB error'))

    // Other operations succeed
    userDevicesMock.mocks.delete.mockResolvedValue({unprocessed: []})
    devicesMock.mocks.delete.mockResolvedValue({unprocessed: []})

    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(207)
    const response = JSON.parse(result.body)
    expect(response.body.message).toContain('Partial deletion')

    // User should NOT be deleted when children fail
    expect(usersMock.entity.delete).not.toHaveBeenCalled()
  })

  test('should delete user with no files or devices', async () => {
    const userId = 'user-empty'

    // Mock empty results
    userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({data: []})
    userFilesMock.mocks.query.byUser!.go.mockResolvedValue({data: []})
    usersMock.mocks.delete.mockResolvedValue(undefined)

    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(204)

    // User should still be deleted
    expect(usersMock.entity.delete).toHaveBeenCalledWith({userId})

    // No child deletions needed
    expect(userFilesMock.entity.delete).not.toHaveBeenCalled()
    expect(userDevicesMock.entity.delete).not.toHaveBeenCalled()
  })

  test('should create GitHub issue when user deletion fails', async () => {
    const userId = 'user-deletion-failure'

    // Mock empty children (so we get to parent deletion)
    userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({data: []})
    userFilesMock.mocks.query.byUser!.go.mockResolvedValue({data: []})

    // Simulate user deletion failure
    usersMock.mocks.delete.mockRejectedValue(new Error('Failed to delete user'))

    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    // Handler catches error and returns 500 after creating GitHub issue
    expect(result.statusCode).toBe(500)

    // Verify GitHub issue was created
    expect(createFailedUserDeletionIssueMock).toHaveBeenCalledWith(userId, [], expect.any(Error), expect.any(String))
  })

  test('should return 500 when no userId in event', async () => {
    // Create event with no userId
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
        authorizer: {
          principalId: 'unknown',
          userId: undefined,
          userStatus: UserStatus.Unauthenticated,
          integrationLatency: 342
        },
        identity: {sourceIp: '127.0.0.1', userAgent: 'test-agent'}
      },
      resource: '/users'
    } as unknown as CustomAPIGatewayRequestAuthorizerEvent

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(500)
  })

  test('should handle multiple devices with SNS endpoint deletion', async () => {
    const userId = 'user-multi-device'
    const devices = [
      {deviceId: 'device-1', endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/App/device-1'},
      {deviceId: 'device-2', endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/App/device-2'},
      {deviceId: 'device-3', endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/App/device-3'}
    ]

    // Mock UserDevices query
    userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({
      data: devices.map((d) => createMockUserDevice(userId, d.deviceId))
    })

    // Mock Devices.get batch
    devicesMock.mocks.get.mockResolvedValue({
      data: devices,
      unprocessed: []
    })

    // Mock empty UserFiles
    userFilesMock.mocks.query.byUser!.go.mockResolvedValue({data: []})

    // Mock all delete operations
    userFilesMock.mocks.delete.mockResolvedValue({unprocessed: []})
    userDevicesMock.mocks.delete.mockResolvedValue({unprocessed: []})
    devicesMock.mocks.delete.mockResolvedValue({unprocessed: []})
    usersMock.mocks.delete.mockResolvedValue(undefined)

    const event = createUserDeleteEvent(userId)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(204)

    // Verify SNS endpoint deletion was called for each device
    expect(deleteEndpointMock).toHaveBeenCalledTimes(3)
  })
})
