/**
 * Event Chain End-to-End Integration Tests
 *
 * Tests the complete event-driven workflow with LocalStack:
 * 1. EventBridge receives DownloadRequested event
 * 2. Rule routes event to SQS DownloadQueue
 * 3. Message arrives with correct structure and correlation ID
 *
 * These tests verify the event-driven pipeline using LocalStack
 * for EventBridge and SQS emulation.
 *
 * @see docs/wiki/Integration/LocalStack-Testing.md
 */

import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'
import {
  createTestEventBus,
  createTestRuleWithSqsTarget,
  deleteTestEventBus,
  publishDownloadRequestedEvent,
  waitForEventBridgeReady
} from '../helpers/eventbridge-helpers'
import {clearTestQueue, createTestQueue, deleteTestQueue, waitForMessages} from '../helpers/sqs-helpers'
import {generateTestResourceName} from '../helpers/resource-naming'

const TEST_EVENT_BUS = generateTestResourceName('test-bus')
const TEST_QUEUE = generateTestResourceName('test-queue')
const TEST_RULE = generateTestResourceName('test-rule')

describe('Event Chain E2E Integration Tests', () => {
  let queueUrl: string
  let queueArn: string

  beforeAll(async () => {
    // Wait for EventBridge to be ready (with retry logic for LocalStack startup)
    await waitForEventBridgeReady(30000)

    // Create test infrastructure
    const queueInfo = await createTestQueue(TEST_QUEUE)
    queueUrl = queueInfo.queueUrl
    queueArn = queueInfo.queueArn

    await createTestEventBus(TEST_EVENT_BUS)
    await createTestRuleWithSqsTarget(TEST_EVENT_BUS, TEST_RULE, 'DownloadRequested', queueArn)
  })

  afterEach(async () => {
    // Clear messages between tests
    await clearTestQueue(queueUrl)
  })

  afterAll(async () => {
    // Clean up test infrastructure
    await deleteTestEventBus(TEST_EVENT_BUS)
    await deleteTestQueue(queueUrl)
  })

  describe('EventBridge to SQS Routing', () => {
    test('should route DownloadRequested event to SQS queue', async () => {
      const fileId = 'test-video-123'
      const fileUrl = 'https://www.youtube.com/watch?v=test-video-123'
      const correlationId = `test-correlation-${Date.now()}`

      // Publish event to EventBridge
      const failedCount = await publishDownloadRequestedEvent(TEST_EVENT_BUS, fileId, fileUrl, correlationId)
      expect(failedCount).toBe(0)

      // Wait for message to arrive in SQS
      const messages = await waitForMessages(queueUrl, 1, 10000)
      expect(messages.length).toBe(1)

      // Verify message structure
      const message = messages[0]
      expect(message.Body).toBeDefined()

      const body = JSON.parse(message.Body!)
      expect(body.source).toBe('media-downloader')
      expect(body['detail-type']).toBe('DownloadRequested')
      expect(body.detail.fileId).toBe(fileId)
      expect(body.detail.fileUrl).toBe(fileUrl)
      expect(body.detail.correlationId).toBe(correlationId)
    })

    test('should handle multiple concurrent events', async () => {
      const events = [
        {fileId: 'video-1', fileUrl: 'https://youtube.com/watch?v=video-1', correlationId: 'corr-1'},
        {fileId: 'video-2', fileUrl: 'https://youtube.com/watch?v=video-2', correlationId: 'corr-2'},
        {fileId: 'video-3', fileUrl: 'https://youtube.com/watch?v=video-3', correlationId: 'corr-3'}
      ]

      // Publish all events concurrently
      const results = await Promise.all(events.map((e) => publishDownloadRequestedEvent(TEST_EVENT_BUS, e.fileId, e.fileUrl, e.correlationId)))

      // All should succeed
      expect(results.every((r) => r === 0)).toBe(true)

      // Wait for all messages
      const messages = await waitForMessages(queueUrl, 3, 15000)
      expect(messages.length).toBe(3)

      // Verify all events arrived
      const fileIds = messages.map((m) => {
        const body = JSON.parse(m.Body!)
        return body.detail.fileId
      })
      expect(fileIds.sort()).toEqual(['video-1', 'video-2', 'video-3'])
    })

    test('should preserve correlation ID through event chain', async () => {
      const correlationId = `trace-${Date.now()}-${Math.random().toString(36).substring(7)}`

      await publishDownloadRequestedEvent(TEST_EVENT_BUS, 'correlation-test', 'https://youtube.com/watch?v=test', correlationId)

      const messages = await waitForMessages(queueUrl, 1, 10000)
      expect(messages.length).toBe(1)

      const body = JSON.parse(messages[0].Body!)
      expect(body.detail.correlationId).toBe(correlationId)
    })
  })

  describe('Event Filtering', () => {
    test('should only route DownloadRequested events, not other types', async () => {
      // Publish a non-matching event directly using putEvents
      const {putEvents} = await import('../lib/vendor/AWS/EventBridge')
      await putEvents([
        {EventBusName: TEST_EVENT_BUS, Source: 'media-downloader', DetailType: 'SomeOtherEvent', Detail: JSON.stringify({test: 'data'}), Time: new Date()}
      ])

      // Should not receive any messages (short timeout)
      const messages = await waitForMessages(queueUrl, 1, 3000)
      expect(messages.length).toBe(0)

      // Now publish a matching event
      await publishDownloadRequestedEvent(TEST_EVENT_BUS, 'filter-test', 'https://youtube.com/test', 'filter-corr')

      // Should receive the matching event
      const matchingMessages = await waitForMessages(queueUrl, 1, 10000)
      expect(matchingMessages.length).toBe(1)
    })
  })
})
