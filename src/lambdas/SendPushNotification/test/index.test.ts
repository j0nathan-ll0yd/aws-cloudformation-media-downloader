import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import type {SQSEvent} from 'aws-lambda'
import {mockClient} from 'aws-sdk-client-mock'
import {PublishCommand, SNSClient} from '@aws-sdk/client-sns'
import {testContext} from '#util/vitest-setup'
import {v4 as uuidv4} from 'uuid'
import {createMockDevice, createMockUserDevice} from '#test/helpers/entity-fixtures'
import {createPushNotificationEvent} from '#test/helpers/event-factories'
import {createSNSPublishResponse} from '#test/helpers/aws-response-factories'

const fakeUserId = '4722a099-bd68-4dd7-842e-0c1127638dd9'
const fakeDeviceId = uuidv4()
const getDeviceResponse = createMockDevice({deviceId: fakeDeviceId})
const getUserDevicesByUserIdResponse = [createMockUserDevice({deviceId: fakeDeviceId, userId: fakeUserId})]

// Create SNS mock - intercepts all SNSClient.send() calls
const snsMock = mockClient(SNSClient)

vi.mock('#entities/queries', () => ({getUserDevicesByUserId: vi.fn(), getDevice: vi.fn()}))

const {handler} = await import('./../src')
import {getDevice, getUserDevicesByUserId} from '#entities/queries'

describe('#SendPushNotification', () => {
  let event: SQSEvent

  beforeEach(() => {
    vi.clearAllMocks()
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

    // Configure SNS mock to return success using factory
    snsMock.on(PublishCommand).resolves(createSNSPublishResponse())

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

    test('should return batch failure when SNS publish fails', async () => {
      vi.mocked(getUserDevicesByUserId).mockResolvedValue(getUserDevicesByUserIdResponse)
      vi.mocked(getDevice).mockResolvedValue(getDeviceResponse)
      snsMock.on(PublishCommand).rejects(new Error('SNS service unavailable'))

      const result = await handler(event, testContext)

      expect(result.batchItemFailures).toEqual([{itemIdentifier: 'ef8f6d44-a3e3-4bf1-9e0f-07576bcb111f'}])
    })

    test('should return batch failure when getUserDevicesByUserId throws', async () => {
      vi.mocked(getUserDevicesByUserId).mockRejectedValue(new Error('Database timeout'))

      const result = await handler(event, testContext)

      expect(result.batchItemFailures).toEqual([{itemIdentifier: 'ef8f6d44-a3e3-4bf1-9e0f-07576bcb111f'}])
    })
  })

  describe('#EdgeCases', () => {
    test('should send notifications to multiple devices', async () => {
      const multipleDevices = [
        createMockUserDevice({deviceId: 'device-1', userId: fakeUserId}),
        createMockUserDevice({deviceId: 'device-2', userId: fakeUserId})
      ]
      vi.mocked(getUserDevicesByUserId).mockResolvedValue(multipleDevices)
      vi.mocked(getDevice).mockResolvedValue(getDeviceResponse)
      snsMock.on(PublishCommand).resolves(createSNSPublishResponse())

      const result = await handler(event, testContext)

      expect(result.batchItemFailures).toEqual([])
      expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 2)
    })

    test('should process multiple SQS records in batch', async () => {
      const multiRecordEvent: SQSEvent = {
        Records: [
          ...createPushNotificationEvent(fakeUserId, 'file-1').Records,
          ...createPushNotificationEvent(fakeUserId, 'file-2').Records
        ]
      }
      vi.mocked(getUserDevicesByUserId).mockResolvedValue(getUserDevicesByUserIdResponse)
      vi.mocked(getDevice).mockResolvedValue(getDeviceResponse)
      snsMock.on(PublishCommand).resolves(createSNSPublishResponse())

      const result = await handler(multiRecordEvent, testContext)

      expect(result.batchItemFailures).toEqual([])
      expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 2)
    })

    test('should continue processing when one device lookup fails (partial success)', async () => {
      const multipleDevices = [
        createMockUserDevice({deviceId: 'device-1', userId: fakeUserId}),
        createMockUserDevice({deviceId: 'device-2', userId: fakeUserId})
      ]
      vi.mocked(getUserDevicesByUserId).mockResolvedValue(multipleDevices)
      // First device succeeds, second device not found
      vi.mocked(getDevice).mockResolvedValueOnce(getDeviceResponse).mockResolvedValueOnce(null)
      snsMock.on(PublishCommand).resolves(createSNSPublishResponse())

      const result = await handler(event, testContext)

      // Partial success = message processed successfully (1 of 2 succeeded)
      expect(result.batchItemFailures).toEqual([])
      expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 1)
    })

    test('should handle device with no endpoint ARN configured', async () => {
      const deviceWithNoArn = createMockDevice({deviceId: fakeDeviceId, endpointArn: undefined})
      vi.mocked(getUserDevicesByUserId).mockResolvedValue(getUserDevicesByUserIdResponse)
      vi.mocked(getDevice).mockResolvedValue(deviceWithNoArn)

      const result = await handler(event, testContext)

      // Device without ARN counts as failure, and it's the only device, so batch fails
      expect(result.batchItemFailures).toEqual([{itemIdentifier: 'ef8f6d44-a3e3-4bf1-9e0f-07576bcb111f'}])
      expect(snsMock).not.toHaveReceivedCommand(PublishCommand)
    })

    test('should handle batch with mixed record outcomes', async () => {
      const multiRecordEvent: SQSEvent = {
        Records: [
          {...createPushNotificationEvent(fakeUserId, 'file-1').Records[0], messageId: 'msg-1'},
          {...createPushNotificationEvent(fakeUserId, 'file-2').Records[0], messageId: 'msg-2'}
        ]
      }
      // First record succeeds, second record has no devices (also succeeds)
      vi.mocked(getUserDevicesByUserId).mockResolvedValueOnce(getUserDevicesByUserIdResponse).mockResolvedValueOnce([])
      vi.mocked(getDevice).mockResolvedValue(getDeviceResponse)
      snsMock.on(PublishCommand).resolves(createSNSPublishResponse())

      const result = await handler(multiRecordEvent, testContext)

      expect(result.batchItemFailures).toEqual([])
      expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 1)
    })
  })
})
