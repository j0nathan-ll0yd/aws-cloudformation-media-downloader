import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import {testContext} from '#util/jest-setup'
import {v4 as uuidv4} from 'uuid'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import {createElectroDBEntityMock} from '#test/helpers/electrodb-mock'
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

const getUserDevicesMock = jest.fn<() => unknown>()
const deleteDeviceMock = jest.fn<() => Promise<void>>()
jest.unstable_mockModule('#util/shared', () => ({
  getUserDevices: getUserDevicesMock, // fmt: multiline
  deleteDevice: deleteDeviceMock
}))

const devicesMock = createElectroDBEntityMock()
jest.unstable_mockModule('#entities/Devices', () => ({Devices: devicesMock.entity}))

const usersMock = createElectroDBEntityMock()
jest.unstable_mockModule('#entities/Users', () => ({Users: usersMock.entity}))

const userFilesMock = createElectroDBEntityMock({queryIndexes: ['byUser']})
jest.unstable_mockModule('#entities/UserFiles', () => ({UserFiles: userFilesMock.entity}))

const userDevicesMock = createElectroDBEntityMock({queryIndexes: ['byUser']})
jest.unstable_mockModule('#entities/UserDevices', () => ({UserDevices: userDevicesMock.entity}))

jest.unstable_mockModule('#lib/vendor/AWS/SNS', () => ({
  deleteEndpoint: jest.fn().mockReturnValue({ResponseMetadata: {RequestId: uuidv4()}}), // fmt: multiline
  subscribe: jest.fn()
}))

jest.unstable_mockModule('#util/github-helpers', () => ({createFailedUserDeletionIssue: jest.fn().mockReturnValue(fakeGithubIssueResponse)}))

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
