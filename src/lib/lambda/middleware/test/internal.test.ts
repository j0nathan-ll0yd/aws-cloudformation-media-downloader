import {afterEach, beforeEach, describe, expect, it, type MockInstance, vi} from 'vitest'
import type {Context, ScheduledEvent} from 'aws-lambda'
import {logger} from '#lib/vendor/Powertools'

describe('Lambda:Middleware:Internal', () => {
  let loggerInfoSpy: MockInstance<typeof logger.info>
  let loggerErrorSpy: MockInstance<typeof logger.error>

  beforeEach(() => {
    loggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined)
    loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    loggerInfoSpy.mockRestore()
    loggerErrorSpy.mockRestore()
  })

  describe('wrapScheduledHandler', () => {
    const mockContext = {awsRequestId: 'scheduled-request-id'} as Context
    const mockEvent = {
      version: '0',
      id: 'test-event-id',
      'detail-type': 'Scheduled Event',
      source: 'aws.events',
      account: '123456789',
      time: '2024-01-01T00:00:00Z',
      region: 'us-east-1',
      resources: [],
      detail: {}
    } as ScheduledEvent

    it('should return result on success', async () => {
      const {wrapScheduledHandler} = await import('../../middleware/internal')
      const handler = wrapScheduledHandler(async () => ({pruned: 5}))

      const result = await handler(mockEvent, mockContext)

      expect(result).toEqual({pruned: 5})
    })

    it('should rethrow errors after logging', async () => {
      const {wrapScheduledHandler} = await import('../../middleware/internal')
      const handler = wrapScheduledHandler(async () => {
        throw new Error('Scheduled task failed')
      })

      await expect(handler(mockEvent, mockContext)).rejects.toThrow('Scheduled task failed')
    })

    it('should pass metadata with traceId to handler', async () => {
      const {wrapScheduledHandler} = await import('../../middleware/internal')
      let receivedMetadata: {traceId: string} | undefined
      const handler = wrapScheduledHandler(async ({metadata}) => {
        receivedMetadata = metadata
      })

      await handler(mockEvent, mockContext)

      expect(receivedMetadata?.traceId).toBe('scheduled-request-id')
    })
  })
})
