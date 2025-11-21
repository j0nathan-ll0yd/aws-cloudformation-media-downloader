import {describe, expect, test, jest, beforeEach} from '@jest/globals'
import {SQSEvent} from 'aws-lambda'
import {UnexpectedError} from '../../../util/errors'
import {testContext} from '../../../util/jest-setup'
import {v4 as uuidv4} from 'uuid'
const fakeUserId = uuidv4()
const fakeDeviceId = uuidv4()
const getUserDevicesByUserIdResponse = {
  Items: [
    {
      devices: new Set([fakeDeviceId]),
      userId: fakeUserId
    }
  ],
  Count: 1,
  ScannedCount: 1
}

const getDeviceResponse = {
  Items: [
    {
      deviceId: fakeDeviceId,
      token: '6a077fd0efd36259b475f9d39997047eebbe45e1d197eed7d64f39d6643c7c23',
      systemName: 'iOS',
      userId: fakeUserId
    }
  ],
  Count: 1,
  ScannedCount: 1
}

const userDevicesGetMock = jest.fn()
const devicesGetMock = jest.fn()
jest.unstable_mockModule('../../../lib/vendor/ElectroDB/entities/UserDevices', () => ({
  UserDevices: {
    get: jest.fn(() => ({go: userDevicesGetMock}))
  }
}))
jest.unstable_mockModule('../../../lib/vendor/ElectroDB/entities/Devices', () => ({
  Devices: {
    get: jest.fn(() => ({go: devicesGetMock}))
  }
}))

const publishSnsEventMock = jest.fn()
jest.unstable_mockModule('../../../lib/vendor/AWS/SNS', () => ({
  publishSnsEvent: publishSnsEventMock
}))

const {default: eventMock} = await import('./fixtures/SQSEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#SendPushNotification', () => {
  let event: SQSEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock)) as SQSEvent
  })
  test('should send a notification for each user device', async () => {
    queryMock.mockReturnValueOnce(getUserDevicesByUserIdResponse)
    queryMock.mockReturnValueOnce(getDeviceResponse)
    const {default: publishSnsEventResponse} = await import('./fixtures/publishSnsEvent-200-OK.json', {assert: {type: 'json'}})
    publishSnsEventMock.mockReturnValue(publishSnsEventResponse)
    const notificationsSent = await handler(event, testContext)
    expect(notificationsSent).toBeUndefined()
  })
  test('should exit gracefully if no devices exist', async () => {
    queryMock.mockReturnValue({
      Items: [],
      Count: 0,
      ScannedCount: 0
    })
    const notificationsSent = await handler(event, testContext)
    expect(notificationsSent).toBeUndefined()
    expect(publishSnsEventMock.mock.calls.length).toBe(0)
  })
  test('should exit if its a different notification type', async () => {
    const modifiedEvent = event
    modifiedEvent.Records[0].body = 'OtherNotification'
    const notificationsSent = await handler(modifiedEvent, testContext)
    expect(notificationsSent).toBeUndefined()
    expect(publishSnsEventMock.mock.calls.length).toBe(0)
  })
  describe('#AWSFailure', () => {
    test('AWS.DynamoDB.DocumentClient.query.getUserDevicesByUserId', async () => {
      queryMock.mockReturnValue(undefined)
      await expect(handler(event, testContext)).rejects.toThrow(UnexpectedError)
    })
    test('AWS.DynamoDB.DocumentClient.query.getDevice', async () => {
      queryMock.mockReturnValueOnce(getUserDevicesByUserIdResponse)
      queryMock.mockReturnValueOnce(undefined)
      const notificationsSent = await handler(event, testContext)
      expect(notificationsSent).toBeUndefined()
      expect(publishSnsEventMock.mock.calls.length).toBe(0)
    })
  })
})
