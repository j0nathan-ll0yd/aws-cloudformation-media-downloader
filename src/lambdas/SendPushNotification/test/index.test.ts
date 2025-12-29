import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {SQSEvent} from 'aws-lambda'
import {testContext} from '#util/vitest-setup'
import {v4 as uuidv4} from 'uuid'

const fakeUserId = uuidv4()
const fakeDeviceId = uuidv4()
const getUserDevicesByUserIdResponse = [{deviceId: fakeDeviceId, userId: fakeUserId, createdAt: new Date()}]

const getDeviceResponse = {
  deviceId: fakeDeviceId,
  token: '6a077fd0efd36259b475f9d39997047eebbe45e1d197eed7d64f39d6643c7c23',
  systemName: 'iOS',
  systemVersion: '17.0',
  name: "Test Device",
  endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/OfflineMediaDownloader/device-id'
}

// Mock native Drizzle query functions
vi.mock('#entities/queries', () => ({
  getUserDevicesByUserId: vi.fn(),
  getDevice: vi.fn()
}))

const publishSnsEventMock = vi.fn<() => unknown>()
vi.mock('#lib/vendor/AWS/SNS', () => ({publishSnsEvent: publishSnsEventMock}))

const {default: eventMock} = await import('./fixtures/SQSEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')
import {getUserDevicesByUserId, getDevice} from '#entities/queries'

describe('#SendPushNotification', () => {
  let event: SQSEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock)) as SQSEvent
  })
  test('should send a notification for each user device', async () => {
    vi.mocked(getUserDevicesByUserId).mockResolvedValue(getUserDevicesByUserIdResponse)
    vi.mocked(getDevice).mockResolvedValue(getDeviceResponse)
    const {default: publishSnsEventResponse} = await import('./fixtures/publishSnsEvent-200-OK.json', {assert: {type: 'json'}})
    publishSnsEventMock.mockReturnValue(publishSnsEventResponse)
    const result = await handler(event, testContext)
    expect(result).toEqual({batchItemFailures: []})
    expect(publishSnsEventMock).toHaveBeenCalled()
  })
  test('should exit gracefully if no devices exist', async () => {
    vi.mocked(getUserDevicesByUserId).mockResolvedValue([])
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
    test('getUserDevicesByUserId returns no data', async () => {
      vi.mocked(getUserDevicesByUserId).mockResolvedValue([])
      const result = await handler(event, testContext)
      expect(result).toEqual({batchItemFailures: []})
    })
    test('getDevice returns null (device not found)', async () => {
      vi.mocked(getUserDevicesByUserId).mockResolvedValue(getUserDevicesByUserIdResponse)
      vi.mocked(getDevice).mockResolvedValue(null)
      const result = await handler(event, testContext)
      expect(result).toEqual({batchItemFailures: [{itemIdentifier: 'ef8f6d44-a3e3-4bf1-9e0f-07576bcb111f'}]})
      expect(publishSnsEventMock.mock.calls.length).toBe(0)
    })
  })
})
