import {describe, expect, test, jest, beforeEach} from '@jest/globals'
import {testContext} from '../../../util/jest-setup'
import {v4 as uuidv4} from 'uuid'
import {CustomAPIGatewayRequestAuthorizerEvent} from '../../../types/main'
const fakeUserId = uuidv4()
const fakeUserDevicesResponse = [
  {
    deviceId: '67C431DE-37D2-4BBA-9055-E9D2766517E1',
    userId: fakeUserId
  },
  {
    deviceId: 'C51C57D9-8898-4584-94D8-81D49B21EB2A',
    userId: fakeUserId
  }
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
  data: {
    id: 1679634750,
    number: 57,
    title: 'UserDelete Failed for UserId: 0f2e90e6-3c52-4d48-a6f2-5119446765f1'
  }
}

const getUserDevicesMock = jest.fn<() => unknown>()
const deleteDeviceMock = jest.fn<() => Promise<void>>()
jest.unstable_mockModule('../../../util/shared', () => ({
  getUserDevices: getUserDevicesMock,
  deleteDevice: deleteDeviceMock
}))

const devicesGetMock = jest.fn<() => Promise<{data: unknown} | undefined>>()
const devicesDeleteGoMock = jest.fn<() => Promise<unknown>>()
jest.unstable_mockModule('../../../entities/Devices', () => ({
  Devices: {
    get: jest.fn(() => ({go: devicesGetMock})),
    delete: jest.fn(() => ({go: devicesDeleteGoMock}))
  }
}))

const usersDeleteMock = jest.fn<() => Promise<unknown>>()
jest.unstable_mockModule('../../../entities/Users', () => ({
  Users: {
    delete: jest.fn(() => ({go: usersDeleteMock}))
  }
}))

const userFilesQueryByUserGoMock = jest.fn<() => Promise<{data: unknown[]}>>()
const userFilesQueryByUserMock = jest.fn(() => ({go: userFilesQueryByUserGoMock}))
const userFilesDeleteMock = jest.fn<() => Promise<unknown>>()
jest.unstable_mockModule('../../../entities/UserFiles', () => ({
  UserFiles: {
    query: {
      byUser: userFilesQueryByUserMock
    },
    delete: jest.fn(() => ({go: userFilesDeleteMock}))
  }
}))

const userDevicesQueryByUserGoMock = jest.fn<() => Promise<{data: unknown[]}>>()
const userDevicesQueryByUserMock = jest.fn(() => ({go: userDevicesQueryByUserGoMock}))
const userDevicesDeleteMock = jest.fn<() => Promise<unknown>>()
jest.unstable_mockModule('../../../entities/UserDevices', () => ({
  UserDevices: {
    query: {
      byUser: userDevicesQueryByUserMock
    },
    delete: jest.fn(() => ({go: userDevicesDeleteMock}))
  }
}))

jest.unstable_mockModule('../../../lib/vendor/AWS/SNS', () => ({
  deleteEndpoint: jest.fn().mockReturnValue({
    ResponseMetadata: {
      RequestId: uuidv4()
    }
  }),
  subscribe: jest.fn()
}))

jest.unstable_mockModule('../../../util/github-helpers', () => ({
  createFailedUserDeletionIssue: jest.fn().mockReturnValue(fakeGithubIssueResponse)
}))

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
    devicesDeleteGoMock.mockResolvedValue({})
    usersDeleteMock.mockResolvedValue({})
    userFilesQueryByUserGoMock.mockResolvedValue({data: []})
    userFilesDeleteMock.mockResolvedValue({})
    userDevicesQueryByUserGoMock.mockResolvedValue({data: []})
    userDevicesDeleteMock.mockResolvedValue({})
  })
  test('should delete all user data', async () => {
    getUserDevicesMock.mockReturnValue(fakeUserDevicesResponse)
    devicesGetMock.mockResolvedValueOnce({data: fakeDevice1})
    devicesGetMock.mockResolvedValueOnce({data: fakeDevice2})
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(204)
  })
  test('should create an issue if deletion fails', async () => {
    usersDeleteMock.mockRejectedValueOnce(new Error('Delete failed'))
    getUserDevicesMock.mockReturnValue(fakeUserDevicesResponse)
    devicesGetMock.mockResolvedValueOnce({data: fakeDevice1})
    devicesGetMock.mockResolvedValueOnce({data: fakeDevice2})
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(500)
  })
  describe('#AWSFailure', () => {
    test('getUserDevices fails', async () => {
      getUserDevicesMock.mockReturnValue(undefined)
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })
    test('Devices.get fails', async () => {
      getUserDevicesMock.mockReturnValue(fakeUserDevicesResponse)
      devicesGetMock.mockResolvedValue(undefined)
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })
    test('AWS.ApiGateway.CustomLambdaAuthorizer', async () => {
      event.requestContext.authorizer!.principalId = 'unknown'
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })
  })
})
