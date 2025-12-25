import {beforeEach, describe, expect, jest, test} from '@jest/globals'

const mockSend = jest.fn<(command: unknown) => Promise<unknown>>()

jest.unstable_mockModule('@aws-sdk/client-eventbridge',
  () => ({EventBridgeClient: jest.fn().mockImplementation(() => ({send: mockSend})), PutEventsCommand: jest.fn().mockImplementation((input) => ({input}))}))

jest.unstable_mockModule('../clients', () => ({createEventBridgeClient: jest.fn().mockReturnValue({send: mockSend})}))

const {publishEvent, putEvents} = await import('../EventBridge')

describe('#EventBridge', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.EVENT_BUS_NAME = 'MediaDownloader'
  })

  describe('putEvents', () => {
    test('should send events to EventBridge', async () => {
      mockSend.mockResolvedValue({FailedEntryCount: 0, Entries: [{EventId: 'event-123'}]})

      const entries = [{EventBusName: 'MediaDownloader', Source: 'test', DetailType: 'TestEvent', Detail: '{}'}]
      const result = await putEvents(entries)

      expect(mockSend).toHaveBeenCalled()
      expect(result.FailedEntryCount).toBe(0)
    })
  })

  describe('publishEvent', () => {
    test('should publish DownloadRequested event with correct structure', async () => {
      mockSend.mockResolvedValue({FailedEntryCount: 0, Entries: [{EventId: 'event-456'}]})

      const detail = {
        fileId: 'abc123',
        userId: 'user-1',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123',
        correlationId: 'corr-1',
        requestedAt: '2024-01-01T00:00:00.000Z'
      }

      const result = await publishEvent('DownloadRequested', detail)

      expect(mockSend).toHaveBeenCalled()
      expect(result.FailedEntryCount).toBe(0)
      expect(result.Entries?.[0].EventId).toBe('event-456')
    })

    test('should publish DownloadCompleted event', async () => {
      mockSend.mockResolvedValue({FailedEntryCount: 0, Entries: [{EventId: 'event-789'}]})

      const detail = {fileId: 'abc123', correlationId: 'corr-1', s3Key: 'abc123.mp4', fileSize: 82784319, completedAt: '2024-01-01T00:05:00.000Z'}

      const result = await publishEvent('DownloadCompleted', detail)

      expect(mockSend).toHaveBeenCalled()
      expect(result.FailedEntryCount).toBe(0)
    })

    test('should publish DownloadFailed event', async () => {
      mockSend.mockResolvedValue({FailedEntryCount: 0, Entries: [{EventId: 'event-101'}]})

      const detail = {
        fileId: 'abc123',
        correlationId: 'corr-1',
        errorCategory: 'transient',
        errorMessage: 'Network timeout',
        retryable: true,
        retryCount: 1,
        failedAt: '2024-01-01T00:05:00.000Z'
      }

      const result = await publishEvent('DownloadFailed', detail)

      expect(mockSend).toHaveBeenCalled()
      expect(result.FailedEntryCount).toBe(0)
    })

    test('should handle failed event entries', async () => {
      mockSend.mockResolvedValue({FailedEntryCount: 1, Entries: [{ErrorCode: 'InternalFailure', ErrorMessage: 'EventBridge service error'}]})

      const detail = {fileId: 'abc123', correlationId: 'corr-1'}

      const result = await publishEvent('DownloadRequested', detail)

      expect(result.FailedEntryCount).toBe(1)
      expect(result.Entries?.[0].ErrorCode).toBe('InternalFailure')
    })
  })
})
