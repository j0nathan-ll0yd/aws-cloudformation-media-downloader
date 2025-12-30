import {afterEach, describe, expect, test, vi} from 'vitest'
import type {ScheduledEvent} from 'aws-lambda'
import {fakePrivateKey, testContext} from '#util/vitest-setup'
import {UnexpectedError} from '#lib/system/errors'
import {createMockDevice} from '#test/helpers/entity-fixtures'
import {mockClient} from 'aws-sdk-client-mock'
import {DeleteEndpointCommand, SNSClient, SubscribeCommand, UnsubscribeCommand} from '@aws-sdk/client-sns'
import {v4 as uuidv4} from 'uuid'

// Create SNS mock - intercepts all SNSClient.send() calls
const snsMock = mockClient(SNSClient)

// Set APNS env vars for ApnsClient
process.env.APNS_SIGNING_KEY = fakePrivateKey
process.env.APNS_TEAM = 'XXXXXX'
process.env.APNS_KEY_ID = 'XXXXXX'
process.env.APNS_DEFAULT_TOPIC = 'lifegames.OfflineMediaDownloader'

// Create test devices with unique tokens for APNS health checks
const fakeDevices = [
  createMockDevice({
    deviceId: 'C51C57D9-8898-4584-94D8-81D49B21EB2A',
    token: '6a077fd0efd36259b475f9d39997047eebbe45e1d197eed7d64f39d6643c7c23',
    systemVersion: '15.6.1',
    name: "Programmer's iPhone"
  }),
  createMockDevice({
    deviceId: '575A3FA3-6565-4F46-ADA3-2D2F6BD96A63',
    token: '0d0752c339fc26c467b1da4f8d3a62480463aa8ccc2f70426022c6d813deb07b',
    systemVersion: '15.6.1',
    name: "Programmer's iPhone"
  }),
  createMockDevice({
    deviceId: '67C431DE-37D2-4BBA-9055-E9D2766517E1',
    token: '1270ac093113154918d1ae96e90247d068b98766842654b3cc2400c7342dc4ba',
    systemVersion: '16.0.3',
    name: 'iPhone'
  }),
  createMockDevice({
    deviceId: '472BD10E-2522-4813-9DBC-54052F677DEB',
    token: '5ff44bb5b361189c1a22ebe7835a8508dbb8878b02ca333f5d3c4d62818a9069',
    systemVersion: '15.6.1',
    name: "Programmer's iPhone"
  })
]

// Mock native Drizzle query functions
vi.mock('#entities/queries', () => ({getAllDevices: vi.fn(), deleteUserDevicesByDeviceId: vi.fn()}))

vi.mock('#lib/domain/device/device-service', () => ({deleteDevice: vi.fn()}))

// Use vi.hoisted() to define mock classes before vi.mock hoists
const {sendMock, MockApnsClient, MockNotification} = vi.hoisted(() => {
  const sendMock = vi.fn()
  class MockApnsClient {
    send() {
      return sendMock()
    }
  }
  class MockNotification {
    constructor(public token: string, public options: object) {}
  }
  return {sendMock, MockApnsClient, MockNotification}
})

vi.mock('apns2', () => ({ApnsClient: MockApnsClient, Notification: MockNotification, Priority: {throttled: 5}, PushType: {background: 'background'}}))

const fakeApnsNotificationOptions = {contentAvailable: true, type: 'background', priority: 5, aps: {health: 'check'}}

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
      deviceToken: fakeDevices[arrayIndex].token,
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
    deviceToken: fakeDevices[arrayIndex].token,
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
import {deleteUserDevicesByDeviceId, getAllDevices} from '#entities/queries'
import {deleteDevice} from '#lib/domain/device/device-service'

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

  afterEach(() => {
    snsMock.reset()
    vi.clearAllMocks()
  })

  // Configure SNS mock responses for each test
  function setupSnsMock() {
    snsMock.on(DeleteEndpointCommand).resolves({$metadata: {requestId: uuidv4()}})
    snsMock.on(SubscribeCommand).resolves({SubscriptionArn: 'arn:aws:sns:us-west-2:123456789:topic:uuid'})
    snsMock.on(UnsubscribeCommand).resolves({$metadata: {requestId: uuidv4()}})
  }

  test('should search for and remove disabled devices (single)', async () => {
    setupSnsMock()
    vi.mocked(getAllDevices).mockResolvedValue(fakeDevices)
    vi.mocked(deleteUserDevicesByDeviceId).mockResolvedValue(undefined)
    vi.mocked(deleteDevice).mockResolvedValue(undefined)
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
    const result = await handler(event, context)
    expect(result.devicesChecked).toBe(4)
    expect(result.devicesPruned).toBe(1)
    expect(result.errors).toHaveLength(0)
  })
  describe('#AWSFailure', () => {
    test('should throw error when device query fails', async () => {
      setupSnsMock()
      vi.mocked(getAllDevices).mockRejectedValue(new Error('Database error'))
      await expect(handler(event, context)).rejects.toThrow()
    })
    test('should continue successfully when user device deletion fails for disabled device', async () => {
      setupSnsMock()
      vi.mocked(getAllDevices).mockResolvedValue(fakeDevices)
      vi.mocked(deleteUserDevicesByDeviceId).mockRejectedValue(new Error('Delete failed'))
      vi.mocked(deleteDevice).mockResolvedValue(undefined)
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
      const result = await handler(event, context)
      expect(result.devicesChecked).toBe(4)
      // Should capture the error instead of pruning
      expect(result.errors).toHaveLength(1)
    })
  })
  describe('#APNSFailure', () => {
    test('should throw error when APNS health check returns unexpected error', async () => {
      setupSnsMock()
      vi.mocked(getAllDevices).mockResolvedValue(fakeDevices)
      sendMock.mockImplementation(() => {
        throw undefined
      })
      await expect(handler(event, context)).rejects.toThrow(UnexpectedError)
    })
  })

  describe('#EdgeCases', () => {
    test('should handle empty device list gracefully', async () => {
      setupSnsMock()
      vi.mocked(getAllDevices).mockResolvedValue([])
      const result = await handler(event, context)
      expect(result.devicesChecked).toBe(0)
      expect(result.devicesPruned).toBe(0)
      expect(result.errors).toHaveLength(0)
      // APNS should not be called if no devices
      expect(sendMock).not.toHaveBeenCalled()
    })

    test('should prune all devices when all are disabled', async () => {
      setupSnsMock()
      vi.mocked(getAllDevices).mockResolvedValue(fakeDevices)
      vi.mocked(deleteUserDevicesByDeviceId).mockResolvedValue(undefined)
      vi.mocked(deleteDevice).mockResolvedValue(undefined)
      // All devices return 410 (expired)
      sendMock.mockImplementation(() => {
        throw getExpiredResponseForDevice(0)
      })
      const result = await handler(event, context)
      expect(result.devicesChecked).toBe(4)
      expect(result.devicesPruned).toBe(4)
      expect(result.errors).toHaveLength(0)
    })

    test('should handle device deletion failure and continue with remaining devices', async () => {
      setupSnsMock()
      vi.mocked(getAllDevices).mockResolvedValue(fakeDevices.slice(0, 2))
      vi.mocked(deleteDevice).mockRejectedValue(new Error('Delete failed'))
      vi.mocked(deleteUserDevicesByDeviceId).mockResolvedValue(undefined)
      // Both devices are expired
      sendMock.mockImplementation(() => {
        throw getExpiredResponseForDevice(0)
      })
      const result = await handler(event, context)
      expect(result.devicesChecked).toBe(2)
      // Both failed, so 0 pruned
      expect(result.devicesPruned).toBe(0)
      expect(result.errors).toHaveLength(2)
    })

    test('should handle mixed success and failure in batch', async () => {
      setupSnsMock()
      vi.mocked(getAllDevices).mockResolvedValue(fakeDevices.slice(0, 3))
      // First device: expired, delete succeeds
      // Second device: expired, delete fails
      // Third device: not expired
      vi.mocked(deleteUserDevicesByDeviceId).mockResolvedValue(undefined)
      vi.mocked(deleteDevice).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Failed'))

      sendMock.mockImplementationOnce(() => {
        throw getExpiredResponseForDevice(0)
      })
      sendMock.mockImplementationOnce(() => {
        throw getExpiredResponseForDevice(1)
      })
      sendMock.mockImplementationOnce(() => {
        return getSuccessfulResponseForDevice(2)
      })

      const result = await handler(event, context)
      expect(result.devicesChecked).toBe(3)
      expect(result.devicesPruned).toBe(1)
      expect(result.errors).toHaveLength(1)
    })

    test('should handle APNS network timeout', async () => {
      setupSnsMock()
      vi.mocked(getAllDevices).mockResolvedValue(fakeDevices.slice(0, 1))
      sendMock.mockImplementation(() => {
        const error = new Error('Network timeout')
        // Not an Apns2Error (no reason property), should throw UnexpectedError
        throw error
      })
      await expect(handler(event, context)).rejects.toThrow(UnexpectedError)
    })
  })
})
