import {describe, expect, test, jest} from '@jest/globals'
import {ScheduledEvent} from 'aws-lambda'
import {fakePrivateKey, testContext} from '../../../util/jest-setup'
import {v4 as uuidv4} from 'uuid'
import {UnexpectedError} from '../../../util/errors'
import {createElectroDBEntityMock} from '../../../../test/helpers/electrodb-mock'
const fakeUserId = uuidv4()
const fakeGetDevicesResponse = {
  Items: [
    {
      deviceId: 'C51C57D9-8898-4584-94D8-81D49B21EB2A',
      token: '6a077fd0efd36259b475f9d39997047eebbe45e1d197eed7d64f39d6643c7c23',
      systemName: 'iOS',
      endpointArn: 'arn:aws:sns:us-west-2:203465012143:endpoint/APNS_SANDBOX/OfflineMediaDownloader/3447299f-275f-329f-b71f-d1f6945033ba',
      systemVersion: '15.6.1',
      name: "Programmer's iPhone"
    },
    {
      deviceId: '575A3FA3-6565-4F46-ADA3-2D2F6BD96A63',
      token: '0d0752c339fc26c467b1da4f8d3a62480463aa8ccc2f70426022c6d813deb07b',
      systemName: 'iOS',
      endpointArn: 'arn:aws:sns:us-west-2:203465012143:endpoint/APNS_SANDBOX/OfflineMediaDownloader/3edbcde7-9985-36bb-9444-81f7a901008b',
      systemVersion: '15.6.1',
      name: "Programmer's iPhone"
    },
    {
      deviceId: '67C431DE-37D2-4BBA-9055-E9D2766517E1',
      token: '1270ac093113154918d1ae96e90247d068b98766842654b3cc2400c7342dc4ba',
      systemName: 'iOS',
      endpointArn: 'arn:aws:sns:us-west-2:203465012143:endpoint/APNS_SANDBOX/OfflineMediaDownloader/29720d05-4add-315d-9dc0-085608820900',
      systemVersion: '16.0.3',
      name: 'iPhone'
    },
    {
      deviceId: '472BD10E-2522-4813-9DBC-54052F677DEB',
      token: '5ff44bb5b361189c1a22ebe7835a8508dbb8878b02ca333f5d3c4d62818a9069',
      systemName: 'iOS',
      endpointArn: 'arn:aws:sns:us-west-2:203465012143:endpoint/APNS_SANDBOX/OfflineMediaDownloader/b48d0b59-9041-390e-aa93-a59e5bc3c1d8',
      systemVersion: '15.6.1',
      name: "Programmer's iPhone"
    }
  ],
  Count: 4,
  ScannedCount: 4
}

const devicesMock = createElectroDBEntityMock()
jest.unstable_mockModule('../../../entities/Devices', () => ({
  Devices: devicesMock.entity
}))

const userDevicesMock = createElectroDBEntityMock({queryIndexes: ['byDevice']})
jest.unstable_mockModule('../../../entities/UserDevices', () => ({
  UserDevices: userDevicesMock.entity
}))

jest.unstable_mockModule('../../../util/secretsmanager-helpers', () => ({
  getApnsSigningKey: jest.fn().mockReturnValue(fakePrivateKey)
}))

jest.unstable_mockModule('../../../lib/vendor/AWS/SNS', () => ({
  deleteEndpoint: jest.fn().mockReturnValue({
    ResponseMetadata: {
      RequestId: uuidv4()
    }
  }),
  subscribe: jest.fn()
}))

const sendMock = jest.fn()
class MockApnsClient {
  send() {
    return sendMock()
  }
}
jest.unstable_mockModule('apns2', () => ({
  ApnsClient: MockApnsClient,
  Notification: jest.fn().mockReturnValue({fake: 'notification'}),
  Priority: jest.fn(),
  PushType: jest.fn()
}))

const fakeApnsNotificationOptions = {
  contentAvailable: true,
  type: 'background',
  priority: 5,
  aps: {
    health: 'check'
  }
}

function getExpiredResponseForDevice(arrayIndex: number) {
  return {
    name: 'Apns2Error',
    message: 'BadExpirationDate',
    statusCode: 410,
    reason: 'BadExpirationDate',
    notification: {
      buildApnsOptions() {
        return fakeApnsNotificationOptions
      },
      deviceToken: fakeGetDevicesResponse.Items?.[arrayIndex].token,
      options: fakeApnsNotificationOptions,
      get priority() {
        return 5
      },
      get pushType() {
        return 'background'
      }
    }
  }
}

function getSuccessfulResponseForDevice(arrayIndex: number) {
  return {
    deviceToken: fakeGetDevicesResponse.Items?.[arrayIndex].token,
    options: fakeApnsNotificationOptions,
    get pushType() {
      return 'background'
    },
    get priority() {
      return 5
    },
    buildApnsOptions() {
      return fakeApnsNotificationOptions
    }
  }
}

const {handler} = await import('./../src')

describe('#PruneDevices', () => {
  const event: ScheduledEvent = {
    'detail-type': 'Scheduled Event',
    account: '',
    detail: undefined,
    id: '',
    region: '',
    resources: [],
    source: '',
    time: '',
    version: ''
  }
  const context = testContext
  test('should search for and remove disabled devices (single)', async () => {
    devicesMock.mocks.scan.go.mockResolvedValue({data: fakeGetDevicesResponse.Items})
    userDevicesMock.mocks.query.byDevice!.go.mockResolvedValue({data: [{userId: fakeUserId, deviceId: 'C51C57D9-8898-4584-94D8-81D49B21EB2A'}]})
    userDevicesMock.mocks.delete.mockResolvedValue({unprocessed: []})
    sendMock.mockImplementationOnce(() => {
      throw getExpiredResponseForDevice(0)
    })
    sendMock.mockImplementationOnce(() => {
      return getSuccessfulResponseForDevice(1)
    })
    sendMock.mockImplementationOnce(() => {
      return getSuccessfulResponseForDevice(2)
    })
    sendMock.mockImplementationOnce(() => {
      return getSuccessfulResponseForDevice(3)
    })
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
  })
  describe('#AWSFailure', () => {
    test('should throw error when device scan fails', async () => {
      devicesMock.mocks.scan.go.mockResolvedValue(undefined)
      await expect(handler(event, context)).rejects.toThrow(UnexpectedError)
    })
    test('should continue successfully when user device query fails for disabled device', async () => {
      devicesMock.mocks.scan.go.mockResolvedValue({data: fakeGetDevicesResponse.Items})
      userDevicesMock.mocks.query.byDevice!.go.mockResolvedValue(undefined)
      sendMock.mockImplementationOnce(() => {
        throw getExpiredResponseForDevice(0)
      })
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(200)
    })
  })
  describe('#APNSFailure', () => {
    test('should throw error when APNS health check returns unexpected error', async () => {
      devicesMock.mocks.scan.go.mockResolvedValue({data: fakeGetDevicesResponse.Items})
      sendMock.mockImplementation(() => {
        throw undefined
      })
      await expect(handler(event, context)).rejects.toThrow(UnexpectedError)
    })
  })
})
