import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import {SQSEvent} from 'aws-lambda'
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
    const {default: publishSnsEventResponse} = await import('./fixtures/publishSnsEvent-200-OK.json', {
      assert: {type: 'json'}
    })
    publishSnsEventMock.mockReturnValue(publishSnsEventResponse)
    const notificationsSent = await handler(event, testContext)
    expect(notificationsSent).toBeUndefined()
  })
  test('should exit gracefully if no devices exist', async () => {
    userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({data: []})
    const notificationsSent = await handler(event, testContext)
    expect(notificationsSent).toBeUndefined()
    expect(publishSnsEventMock.mock.calls.length).toBe(0)
  })
  test('should exit if its a different notification type', async () => {
    const modifiedEvent = event
    modifiedEvent.Records[0].body = 'OtherNotification'
    const notificationsSent = await handler(event, testContext)
    expect(notificationsSent).toBeUndefined()
    expect(publishSnsEventMock.mock.calls.length).toBe(0)
  })
  describe('#AWSFailure', () => {
    test('ElectroDB UserDevices.query returns no data', async () => {
      userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({data: []})
      const notificationsSent = await handler(event, testContext)
      expect(notificationsSent).toBeUndefined()
    })
    test('ElectroDB Devices.get fails', async () => {
      userDevicesMock.mocks.query.byUser!.go.mockResolvedValue({data: getUserDevicesByUserIdResponse})
      devicesMock.mocks.get.mockResolvedValue(undefined)
      const notificationsSent = await handler(event, testContext)
      expect(notificationsSent).toBeUndefined()
      expect(publishSnsEventMock.mock.calls.length).toBe(0)
    })
  })
})
