import {beforeEach, describe, expect, test, vi} from 'vitest'
import {testContext} from '#util/vitest-setup'
import {v4 as uuidv4} from 'uuid'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import {createEntityMock} from '#test/helpers/entity-mock'
const fakeUserId = uuidv4()
const fakeUserDevicesResponse = [
  {deviceId: '67C431DE-37D2-4BBA-9055-E9D2766517E1', userId: fakeUserId}, // fmt: multiline
  {deviceId: 'C51C57D9-8898-4584-94D8-81D49B21EB2A', userId: fakeUserId}
]
const fakeDevice1 = {
  deviceId: '67C431DE-37D2-4BBA-9055-E9D2766517E1',
  token: 'fake-token',
  systemName: 'iOS',
  endpointArn: 'fake-endpointArn',
  systemVersion: '16.0.2',
  name: 'iPhone'
}

const fakeDevice2 = {
  deviceId: 'C51C57D9-8898-4584-94D8-81D49B21EB2A',
  token: 'fake-token',
  systemName: 'iOS',
  endpointArn: 'fake-endpointArn',
  systemVersion: '16.0.2',
  name: 'iPhone'
}

const fakeGithubIssueResponse = {
  status: '201',
  url: 'https://api.github.com/repos/j0nathan-ll0yd/aws-cloudformation-media-downloader/issues',
  headers: {},
  data: {id: 1679634750, number: 57, title: 'UserDelete Failed for UserId: 0f2e90e6-3c52-4d48-a6f2-5119446765f1'}
}

const getUserDevicesMock = vi.fn<() => unknown>()
const deleteDeviceMock = vi.fn<() => Promise<void>>()
vi.mock('#lib/domain/device/device-service', () => ({
  getUserDevices: getUserDevicesMock, // fmt: multiline
  deleteDevice: deleteDeviceMock,
  deleteUserDevice: vi.fn()
}))

const devicesMock = createEntityMock()
vi.mock('#entities/Devices', () => ({Devices: devicesMock.entity}))

const usersMock = createEntityMock()
vi.mock('#entities/Users', () => ({Users: usersMock.entity}))

const userFilesMock = createEntityMock({queryIndexes: ['byUser']})
vi.mock('#entities/UserFiles', () => ({UserFiles: userFilesMock.entity}))

const userDevicesMock = createEntityMock({queryIndexes: ['byUser']})
vi.mock('#entities/UserDevices', () => ({UserDevices: userDevicesMock.entity}))

vi.mock('#lib/vendor/AWS/SNS', () => ({
  deleteEndpoint: vi.fn().mockReturnValue({ResponseMetadata: {RequestId: uuidv4()}}), // fmt: multiline
  subscribe: vi.fn(),
  unsubscribe: vi.fn()
}))

vi.mock('#lib/integrations/github/issue-service', () => ({createFailedUserDeletionIssue: vi.fn().mockReturnValue(fakeGithubIssueResponse)}))

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#UserDelete', () => {
  let event: CustomAPIGatewayRequestAuthorizerEvent
  const context = testContext
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    event.requestContext.authorizer!.principalId = fakeUserId

    // Set default mock return values
    deleteDeviceMock.mockResolvedValue(undefined)
    devicesMock.mocks.get.mockResolvedValue({data: [], unprocessed: []})
    devicesMock.mocks.delete.mockResolvedValue(undefined)
    usersMock.mocks.delete.mockResolvedValue(undefined)
    userFilesMock.mocks.query.byUser!.go.mockResolvedValue({data: []})
    userFilesMock.mocks.delete.mockResolvedValue({unprocessed: []})
    userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({data: []})
    userDevicesMock.mocks.delete.mockResolvedValue({unprocessed: []})
  })
  test('should delete all user data', async () => {
    getUserDevicesMock.mockReturnValue(fakeUserDevicesResponse)
    devicesMock.mocks.get.mockResolvedValue({data: [fakeDevice1, fakeDevice2], unprocessed: []})
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(204)
  })
  test('should create an issue if deletion fails', async () => {
    usersMock.mocks.delete.mockRejectedValueOnce(new Error('Delete failed'))
    getUserDevicesMock.mockReturnValue(fakeUserDevicesResponse)
    devicesMock.mocks.get.mockResolvedValue({data: [fakeDevice1, fakeDevice2], unprocessed: []})
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
    devicesMock.mocks.get.mockResolvedValue({data: [fakeDevice1, fakeDevice2], unprocessed: []})
    // User has 3 files to delete
    userFilesMock.mocks.query.byUser!.go.mockResolvedValue({
      data: [
        {userId: fakeUserId, fileId: 'file-1'},
        {userId: fakeUserId, fileId: 'file-2'},
        {userId: fakeUserId, fileId: 'file-3'}
      ]
    })
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(204)
    expect(userFilesMock.mocks.delete).toHaveBeenCalled()
  })

  describe('#PartialFailures', () => {
    test('should return 207 when UserFiles deletion fails', async () => {
      getUserDevicesMock.mockReturnValue(fakeUserDevicesResponse)
      devicesMock.mocks.get.mockResolvedValue({data: [fakeDevice1, fakeDevice2], unprocessed: []})
      // UserFiles query succeeds, but delete fails
      userFilesMock.mocks.query.byUser!.go.mockResolvedValue({data: [{userId: fakeUserId, fileId: 'file-1'}]})
      userFilesMock.mocks.delete.mockRejectedValue(new Error('UserFiles deletion failed'))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(207)
      const body = JSON.parse(output.body)
      expect(body.body.message).toContain('Partial deletion')
      expect(body.body.failedOperations).toBeGreaterThan(0)
    })

    test('should return 207 when device deletion fails', async () => {
      getUserDevicesMock.mockReturnValue(fakeUserDevicesResponse)
      devicesMock.mocks.get.mockResolvedValue({data: [fakeDevice1, fakeDevice2], unprocessed: []})
      // Relations delete successfully, but device deletion fails
      deleteDeviceMock.mockRejectedValue(new Error('Device deletion failed'))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(207)
      const body = JSON.parse(output.body)
      expect(body.body.message).toContain('devices could not be removed')
    })

    test('should not delete user when relation deletion fails', async () => {
      getUserDevicesMock.mockReturnValue(fakeUserDevicesResponse)
      devicesMock.mocks.get.mockResolvedValue({data: [fakeDevice1, fakeDevice2], unprocessed: []})
      // UserDevices deletion fails
      userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({data: [{userId: fakeUserId, deviceId: 'device-1'}]})
      userDevicesMock.mocks.delete.mockRejectedValue(new Error('UserDevices deletion failed'))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(207)
      // User should NOT be deleted when children fail
      expect(usersMock.mocks.delete).not.toHaveBeenCalled()
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
      devicesMock.mocks.get.mockResolvedValue({data: [], unprocessed: []})
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
