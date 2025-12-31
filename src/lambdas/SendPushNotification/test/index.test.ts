import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import type {SQSEvent} from 'aws-lambda'
import {mockClient} from 'aws-sdk-client-mock'
import {PublishCommand, SNSClient} from '@aws-sdk/client-sns'
import {testContext} from '#util/vitest-setup'
import {v4 as uuidv4} from 'uuid'
import {createMockDevice, createMockUserDevice} from '#test/helpers/entity-fixtures'
import {createPushNotificationEvent} from '#test/helpers/event-factories'

const fakeUserId = '4722a099-bd68-4dd7-842e-0c1127638dd9'
const fakeDeviceId = uuidv4()
const getDeviceResponse = createMockDevice({deviceId: fakeDeviceId})
const getUserDevicesByUserIdResponse = [createMockUserDevice({deviceId: fakeDeviceId, userId: fakeUserId})]

// Create SNS mock - intercepts all SNSClient.send() calls
const snsMock = mockClient(SNSClient)

// Mock native Drizzle query functions
vi.mock('#entities/queries', () => ({getUserDevicesByUserId: vi.fn(), getDevice: vi.fn()}))

const {handler} = await import('./../src')
import {getDevice, getUserDevicesByUserId} from '#entities/queries'

describe('#SendPushNotification', () => {
  let event: SQSEvent

  beforeEach(() => {
    // Create push notification event with message ID for batch failure tracking
    event = createPushNotificationEvent(fakeUserId, 'CGYBu-3Oi24', {title: 'Philip DeFranco', key: '20221017-[Philip DeFranco].mp4'})
    // Override the messageId to match expected batch failure ID
    event.Records[0].messageId = 'ef8f6d44-a3e3-4bf1-9e0f-07576bcb111f'
    snsMock.reset()
  })

  afterEach(() => {
    snsMock.reset()
  })

  test('should send a notification for each user device', async () => {
    vi.mocked(getUserDevicesByUserId).mockResolvedValue(getUserDevicesByUserIdResponse)
    vi.mocked(getDevice).mockResolvedValue(getDeviceResponse)

    // Configure SNS mock to return success
    snsMock.on(PublishCommand).resolves({MessageId: 'f03e3435-bc65-5006-8e52-62f8f1855e29'})

    const result = await handler(event, testContext)

    expect(result).toEqual({batchItemFailures: []})
    // Use aws-sdk-client-mock-vitest matchers for type-safe assertions
    expect(snsMock).toHaveReceivedCommand(PublishCommand)
  })

  test('should exit gracefully if no devices exist', async () => {
    vi.mocked(getUserDevicesByUserId).mockResolvedValue([])

    const result = await handler(event, testContext)

    expect(result).toEqual({batchItemFailures: []})
    // Verify SNS was NOT called using the negative matcher
    expect(snsMock).not.toHaveReceivedCommand(PublishCommand)
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
    expect(snsMock).not.toHaveReceivedCommand(PublishCommand)
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
      expect(snsMock).not.toHaveReceivedCommand(PublishCommand)
    })
  })
})
