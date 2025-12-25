/**
 * EventBridge Vendor Wrapper Integration Tests
 *
 * Tests the EventBridge vendor wrapper against LocalStack.
 * Validates that events can be published to the event bus.
 */

process.env.USE_LOCALSTACK = 'true'
process.env.EVENT_BUS_NAME = 'test-eventbridge-integration'

import {afterAll, beforeAll, describe, expect, test} from '@jest/globals'
import {publishEvent} from '#lib/vendor/AWS/EventBridge'
import {createTestEventBus, deleteTestEventBus, verifyEventBusExists} from '../../../helpers/eventbridge-helpers'

describe('EventBridge Vendor Wrapper Integration', () => {
  beforeAll(async () => {
    await createTestEventBus()
    await new Promise((resolve) => setTimeout(resolve, 500))
  })

  afterAll(async () => {
    await deleteTestEventBus()
  })

  test('should create event bus in LocalStack', async () => {
    const exists = await verifyEventBusExists()
    expect(exists).toBe(true)
  })

  test('should publish DownloadRequested event successfully', async () => {
    const detail = {
      fileId: 'test-video-123',
      userId: 'user-123',
      sourceUrl: 'https://www.youtube.com/watch?v=test-video-123',
      correlationId: 'corr-123',
      requestedAt: new Date().toISOString()
    }

    const result = await publishEvent('DownloadRequested', detail)

    expect(result.FailedEntryCount).toBe(0)
    expect(result.Entries).toHaveLength(1)
    expect(result.Entries?.[0].EventId).toBeDefined()
  })

  test('should publish DownloadCompleted event successfully', async () => {
    const detail = {
      fileId: 'test-video-123',
      correlationId: 'corr-123',
      s3Key: 'test-video-123.mp4',
      fileSize: 82784319,
      completedAt: new Date().toISOString()
    }

    const result = await publishEvent('DownloadCompleted', detail)

    expect(result.FailedEntryCount).toBe(0)
    expect(result.Entries).toHaveLength(1)
  })

  test('should publish DownloadFailed event successfully', async () => {
    const detail = {
      fileId: 'test-video-123',
      correlationId: 'corr-123',
      errorCategory: 'transient',
      errorMessage: 'Network timeout',
      retryable: true,
      retryCount: 1,
      failedAt: new Date().toISOString()
    }

    const result = await publishEvent('DownloadFailed', detail)

    expect(result.FailedEntryCount).toBe(0)
    expect(result.Entries).toHaveLength(1)
  })
})
