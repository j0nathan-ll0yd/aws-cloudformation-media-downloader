import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import type {SQSEvent} from 'aws-lambda'
import {testContext} from '#util/jest-setup'
import {v4 as uuidv4} from 'uuid'
import {createElectroDBEntityMock} from '#test/helpers/electrodb-mock'
const fakeUserId = uuidv4()
const fakeDeviceId = uuidv4()
const getUserDevicesByUserIdResponse = [{deviceId: fakeDeviceId, userId: fakeUserId}]

const getDeviceResponse = {
  deviceId: fakeDeviceId,
  token: '6a077fd0efd36259b475f9d39997047eebbe45e1d197eed7d64f39d6643c7c23',
  systemName: 'iOS',
  endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/OfflineMediaDownloader/device-id'
}

const userDevicesMock = createElectroDBEntityMock({queryIndexes: ['byUser']})
jest.unstable_mockModule('#entities/UserDevices', () => ({UserDevices: userDevicesMock.entity}))

const devicesMock = createElectroDBEntityMock()
jest.unstable_mockModule('#entities/Devices', () => ({Devices: devicesMock.entity}))

const publishSnsEventMock = jest.fn<() => unknown>()
jest.unstable_mockModule('#lib/vendor/AWS/SNS', () => ({publishSnsEvent: publishSnsEventMock}))

const {default: eventMock} = await import('./fixtures/SQSEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#SendPushNotification', () => {
  let event: SQSEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock)) as SQSEvent
  })
  test('should send a notification for each user device', async () => {
    userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({data: getUserDevicesByUserIdResponse})
    devicesMock.mocks.get.mockResolvedValue({data: getDeviceResponse})
    const {default: publishSnsEventResponse} = await import('./fixtures/publishSnsEvent-200-OK.json', {assert: {type: 'json'}})
    publishSnsEventMock.mockReturnValue(publishSnsEventResponse)
    const result = await handler(event, testContext)
    expect(result).toEqual({batchItemFailures: []})
    expect(publishSnsEventMock).toHaveBeenCalled()
  })
  test('should exit gracefully if no devices exist', async () => {
    userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({data: []})
    const result = await handler(event, testContext)
    expect(result).toEqual({batchItemFailures: []})
    expect(publishSnsEventMock.mock.calls.length).toBe(0)
  })
  test('should exit if its a different notification type', async () => {
    const modifiedEvent = JSON.parse(JSON.stringify(event)) as SQSEvent
    modifiedEvent.Records[0].messageAttributes.notificationType = {
      stringValue: 'OtherNotification',
      stringListValues: [],
      binaryListValues: [],
      dataType: 'String'
    }
    const result = await handler(modifiedEvent, testContext)
    expect(result).toEqual({batchItemFailures: []})
    expect(publishSnsEventMock.mock.calls.length).toBe(0)
  })
  describe('#AWSFailure', () => {
    test('ElectroDB UserDevices.query returns no data', async () => {
      userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({data: []})
      const result = await handler(event, testContext)
      expect(result).toEqual({batchItemFailures: []})
    })
    test('ElectroDB Devices.get fails', async () => {
      userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({data: getUserDevicesByUserIdResponse})
      devicesMock.mocks.get.mockResolvedValue(undefined)
      const result = await handler(event, testContext)
      expect(result).toEqual({batchItemFailures: [{itemIdentifier: 'ef8f6d44-a3e3-4bf1-9e0f-07576bcb111f'}]})
      expect(publishSnsEventMock.mock.calls.length).toBe(0)
    })
  })
})
