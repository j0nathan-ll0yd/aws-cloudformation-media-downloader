import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import type {SQSEvent} from 'aws-lambda'
import {mockClient} from 'aws-sdk-client-mock'
import {PublishCommand, SNSClient} from '@aws-sdk/client-sns'
import {testContext} from '#util/vitest-setup'
import {v4 as uuidv4} from 'uuid'
import {createMockDevice, createMockUserDevice} from '#test/helpers/entity-fixtures'

const fakeUserId = uuidv4()
const fakeDeviceId = uuidv4()
const getDeviceResponse = createMockDevice({deviceId: fakeDeviceId})
const getUserDevicesByUserIdResponse = [createMockUserDevice({deviceId: fakeDeviceId, userId: fakeUserId})]

// Create SNS mock - intercepts all SNSClient.send() calls
const snsMock = mockClient(SNSClient)

// Type helper for aws-sdk-client-mock-vitest matchers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AwsMockExpect = (mock: any) => {toHaveReceivedCommand: (cmd: unknown) => void; not: {toHaveReceivedCommand: (cmd: unknown) => void}}
const expectMock = expect as unknown as AwsMockExpect

// Mock native Drizzle query functions
vi.mock('#entities/queries', () => ({getUserDevicesByUserId: vi.fn(), getDevice: vi.fn()}))

const {default: eventMock} = await import('./fixtures/SQSEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')
import {getDevice, getUserDevicesByUserId} from '#entities/queries'

describe('#SendPushNotification', () => {
  let event: SQSEvent

  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock)) as SQSEvent
    snsMock.reset()
  })

  afterEach(() => {
    snsMock.reset()
  })

  test('should send a notification for each user device', async () => {
    vi.mocked(getUserDevicesByUserId).mockResolvedValue(getUserDevicesByUserIdResponse)
    vi.mocked(getDevice).mockResolvedValue(getDeviceResponse)

    // Configure SNS mock to return success
    const publishSnsEventResponse = await import('./fixtures/publishSnsEvent-200-OK.json', {assert: {type: 'json'}})
    snsMock.on(PublishCommand).resolves(publishSnsEventResponse.default)

    const result = await handler(event, testContext)

    expect(result).toEqual({batchItemFailures: []})
    // Use aws-sdk-client-mock-vitest matchers for type-safe assertions
    expectMock(snsMock).toHaveReceivedCommand(PublishCommand)
  })

  test('should exit gracefully if no devices exist', async () => {
    vi.mocked(getUserDevicesByUserId).mockResolvedValue([])

    const result = await handler(event, testContext)

    expect(result).toEqual({batchItemFailures: []})
    // Verify SNS was NOT called using the negative matcher
    expectMock(snsMock).not.toHaveReceivedCommand(PublishCommand)
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
    expectMock(snsMock).not.toHaveReceivedCommand(PublishCommand)
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
      expectMock(snsMock).not.toHaveReceivedCommand(PublishCommand)
    })
  })
})
