import {afterAll, afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {createMockContext} from '#util/vitest-setup'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'
import {createMockDevice, createMockUserDevice, DEFAULT_USER_ID} from '#test/helpers/entity-fixtures'
import {DeleteEndpointCommand, SubscribeCommand, UnsubscribeCommand} from '@aws-sdk/client-sns'
import {createAPIGatewayEvent} from '#test/helpers/event-factories'
import {createSNSMetadataResponse, createSNSSubscribeResponse} from '#test/helpers/aws-response-factories'
import {createSNSMock, resetAllAwsMocks} from '#test/helpers/aws-sdk-mock'

const fakeUserId = DEFAULT_USER_ID
const fakeDevice1 = createMockDevice({deviceId: '67C431DE-37D2-4BBA-9055-E9D2766517E1'})
const fakeDevice2 = createMockDevice({deviceId: 'C51C57D9-8898-4584-94D8-81D49B21EB2A', name: 'iPhone 2'})
const fakeUserDevicesResponse = [
  createMockUserDevice({deviceId: fakeDevice1.deviceId, userId: fakeUserId}),
  createMockUserDevice({deviceId: fakeDevice2.deviceId, userId: fakeUserId})
]

// Create SNS mock using helper - injects into vendor client factory
const snsMock = createSNSMock()

const fakeGithubIssueResponse = {
  status: '201',
  url: 'https://api.github.com/repos/j0nathan-ll0yd/aws-cloudformation-media-downloader/issues',
  headers: {},
  data: {id: 1679634750, number: 57, title: 'UserDelete Failed for UserId: 0f2e90e6-3c52-4d48-a6f2-5119446765f1'}
}

const getUserDevicesMock = vi.fn<() => unknown>()
const deleteDeviceMock = vi.fn<() => Promise<void>>()
vi.mock('#lib/services/device/deviceService', () => ({
  getUserDevices: getUserDevicesMock, // fmt: multiline
  deleteDevice: deleteDeviceMock,
  deleteUserDevice: vi.fn()
}))

vi.mock('#entities/queries', () => ({deleteUser: vi.fn(), deleteUserDevicesByUserId: vi.fn(), deleteUserFilesByUserId: vi.fn(), getDevicesBatch: vi.fn()}))

vi.mock('#lib/integrations/github/issueService', () => ({createFailedUserDeletionIssue: vi.fn().mockReturnValue(fakeGithubIssueResponse)}))

const {handler} = await import('./../src')
import {deleteUser, deleteUserDevicesByUserId, deleteUserFilesByUserId, getDevicesBatch} from '#entities/queries'

describe('#UserDelete', () => {
  let event: CustomAPIGatewayRequestAuthorizerEvent
  const context = createMockContext()
  beforeEach(() => {
    vi.clearAllMocks()
    event = createAPIGatewayEvent({path: '/users', httpMethod: 'DELETE', userId: fakeUserId})

    // Configure SNS mock responses using factories
    snsMock.on(DeleteEndpointCommand).resolves(createSNSMetadataResponse())
    snsMock.on(SubscribeCommand).resolves(createSNSSubscribeResponse())
    snsMock.on(UnsubscribeCommand).resolves(createSNSMetadataResponse())

    // Set default mock return values
    deleteDeviceMock.mockResolvedValue(undefined)
    vi.mocked(getDevicesBatch).mockResolvedValue([])
    vi.mocked(deleteUser).mockResolvedValue(undefined)
    vi.mocked(deleteUserFilesByUserId).mockResolvedValue(undefined)
    vi.mocked(deleteUserDevicesByUserId).mockResolvedValue(undefined)
  })

  afterEach(() => {
    snsMock.reset()
  })

  afterAll(() => {
    resetAllAwsMocks()
  })

  test('should delete all user data', async () => {
    getUserDevicesMock.mockReturnValue(fakeUserDevicesResponse)
    vi.mocked(getDevicesBatch).mockResolvedValue([fakeDevice1, fakeDevice2])
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(204)
    // Verify device deletion was called for each device
    expect(deleteDeviceMock).toHaveBeenCalledTimes(2)
  })
  test('should create an issue if deletion fails', async () => {
    vi.mocked(deleteUser).mockRejectedValueOnce(new Error('Delete failed'))
    getUserDevicesMock.mockReturnValue(fakeUserDevicesResponse)
    vi.mocked(getDevicesBatch).mockResolvedValue([fakeDevice1, fakeDevice2])
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(500)
  })
  test('should delete user with no devices successfully', async () => {
    // User has no devices - should still complete deletion
    getUserDevicesMock.mockReturnValue([])
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(204)
  })

  test('should delete user files during cascade deletion', async () => {
    getUserDevicesMock.mockReturnValue(fakeUserDevicesResponse)
    vi.mocked(getDevicesBatch).mockResolvedValue([fakeDevice1, fakeDevice2])
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(204)
    expect(vi.mocked(deleteUserFilesByUserId)).toHaveBeenCalled()
  })

  describe('#PartialFailures', () => {
    test('should return 207 when UserFiles deletion fails', async () => {
      getUserDevicesMock.mockReturnValue(fakeUserDevicesResponse)
      vi.mocked(getDevicesBatch).mockResolvedValue([fakeDevice1, fakeDevice2])
      // UserFiles deletion fails
      vi.mocked(deleteUserFilesByUserId).mockRejectedValue(new Error('UserFiles deletion failed'))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(207)
      const body = JSON.parse(output.body)
      expect(body.body.message).toContain('Partial deletion')
      expect(body.body.failedOperations).toBeGreaterThan(0)
    })

    test('should return 207 when device deletion fails', async () => {
      getUserDevicesMock.mockReturnValue(fakeUserDevicesResponse)
      vi.mocked(getDevicesBatch).mockResolvedValue([fakeDevice1, fakeDevice2])
      // Relations delete successfully, but device deletion fails
      deleteDeviceMock.mockRejectedValue(new Error('Device deletion failed'))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(207)
      const body = JSON.parse(output.body)
      expect(body.body.message).toContain('devices could not be removed')
    })

    test('should not delete user when relation deletion fails', async () => {
      getUserDevicesMock.mockReturnValue(fakeUserDevicesResponse)
      vi.mocked(getDevicesBatch).mockResolvedValue([fakeDevice1, fakeDevice2])
      // UserDevices deletion fails
      vi.mocked(deleteUserDevicesByUserId).mockRejectedValue(new Error('UserDevices deletion failed'))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(207)
      // User should NOT be deleted when children fail
      expect(vi.mocked(deleteUser)).not.toHaveBeenCalled()
    })
  })

  describe('#AWSFailure', () => {
    test('should return 500 error when user device retrieval fails', async () => {
      getUserDevicesMock.mockReturnValue(undefined)
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })
    test('should return 500 error when batch device retrieval fails', async () => {
      getUserDevicesMock.mockReturnValue(fakeUserDevicesResponse)
      vi.mocked(getDevicesBatch).mockResolvedValue([])
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })
    test('should return 401 error when user ID is missing (unauthenticated)', async () => {
      // With Authorization header but unknown principalId = Unauthenticated
      event.requestContext.authorizer!.principalId = 'unknown'
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(401)
    })
    test('should return 401 error for anonymous users (no auth header)', async () => {
      // Without Authorization header = Anonymous
      delete event.headers.Authorization
      event.requestContext.authorizer!.principalId = 'unknown'
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(401)
    })
  })
})
