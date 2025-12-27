/**
 * SQS Vendor Wrapper Integration Tests
 *
 * Tests the SQS vendor wrapper against LocalStack to verify:
 * - Queue creation/deletion
 * - Message sending/receiving
 * - Message attributes
 * - Queue attributes (message counts)
 *
 * These tests validate that src/lib/vendor/AWS/SQS.ts works correctly
 * with real AWS SDK calls against LocalStack.
 */

process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'

import {afterAll, beforeAll, beforeEach, describe, expect, test} from '@jest/globals'
import {
  createTestQueue,
  deleteTestMessage,
  deleteTestQueue,
  drainQueue,
  getMessageCount,
  numberAttribute,
  receiveOneMessage,
  receiveTestMessages,
  sendJsonMessage,
  sendTestMessage,
  stringAttribute,
  waitForMessage
} from '../helpers/sqs-helpers'

describe('SQS Vendor Wrapper Integration Tests', () => {
  const testQueueName = `test-sqs-${Date.now()}`
  let queueUrl: string

  beforeAll(async () => {
    queueUrl = await createTestQueue(testQueueName)
  })

  afterAll(async () => {
    await deleteTestQueue(queueUrl)
  })

  beforeEach(async () => {
    // Drain queue before each test for isolation
    await drainQueue(queueUrl)
  })

  describe('Queue Operations', () => {
    test('should create queue with valid URL', () => {
      expect(queueUrl).toContain('localhost:4566')
      expect(queueUrl).toContain(testQueueName)
    })

    test('should create queue with custom attributes', async () => {
      const customQueueName = `test-custom-${Date.now()}`
      const customQueueUrl = await createTestQueue(customQueueName, {visibilityTimeout: 60, delaySeconds: 5})

      expect(customQueueUrl).toContain(customQueueName)

      await deleteTestQueue(customQueueUrl)
    })
  })

  describe('Message Operations', () => {
    test('should send and receive simple message', async () => {
      const messageBody = 'Hello, LocalStack!'

      const messageId = await sendTestMessage(queueUrl, messageBody)
      expect(messageId).toBeDefined()

      const received = await receiveOneMessage(queueUrl)
      expect(received).not.toBeNull()
      expect(received!.Body).toBe(messageBody)
      expect(received!.MessageId).toBe(messageId)
    })

    test('should send and receive JSON message', async () => {
      const payload = {action: 'processFile', fileId: 'file-123', userId: 'user-456', metadata: {size: 1024, type: 'video/mp4'}}

      await sendJsonMessage(queueUrl, payload)

      const received = await receiveOneMessage(queueUrl)
      expect(received).not.toBeNull()

      const parsed = JSON.parse(received!.Body!)
      expect(parsed).toEqual(payload)
    })

    test('should send message with attributes', async () => {
      const messageBody = 'Message with attributes'
      const attributes = {EventType: stringAttribute('FileUploaded'), FileSize: numberAttribute(2048), Priority: stringAttribute('high')}

      await sendTestMessage(queueUrl, messageBody, attributes)

      const received = await receiveOneMessage(queueUrl)
      expect(received).not.toBeNull()
      expect(received!.MessageAttributes).toBeDefined()
      expect(received!.MessageAttributes!['EventType'].StringValue).toBe('FileUploaded')
      expect(received!.MessageAttributes!['FileSize'].StringValue).toBe('2048')
      expect(received!.MessageAttributes!['Priority'].StringValue).toBe('high')
    })

    test('should receive multiple messages in batch', async () => {
      // Send 5 messages
      for (let i = 0; i < 5; i++) {
        await sendTestMessage(queueUrl, `Message ${i + 1}`)
      }

      // Receive batch
      const messages = await receiveTestMessages(queueUrl, {maxMessages: 5})
      expect(messages.length).toBeGreaterThanOrEqual(1)
      expect(messages.length).toBeLessThanOrEqual(5)
    })

    test('should delete message after processing', async () => {
      await sendTestMessage(queueUrl, 'To be deleted')

      const received = await receiveOneMessage(queueUrl)
      expect(received).not.toBeNull()

      await deleteTestMessage(queueUrl, received!)

      // Message should no longer be available
      const afterDelete = await receiveOneMessage(queueUrl, 1)
      expect(afterDelete).toBeNull()
    })
  })

  describe('Queue Monitoring', () => {
    test('should report accurate message count', async () => {
      // Start with empty queue
      const initialCount = await getMessageCount(queueUrl)
      expect(initialCount).toBe(0)

      // Send messages
      await sendTestMessage(queueUrl, 'Count test 1')
      await sendTestMessage(queueUrl, 'Count test 2')
      await sendTestMessage(queueUrl, 'Count test 3')

      // Check count (may have slight delay)
      const count = await getMessageCount(queueUrl)
      expect(count).toBe(3)
    })

    test('should wait for message arrival', async () => {
      // Start async message send after delay
      setTimeout(async () => {
        await sendTestMessage(queueUrl, 'Delayed message')
      }, 500)

      // Wait should return true when message arrives
      const arrived = await waitForMessage(queueUrl, 5000)
      expect(arrived).toBe(true)
    })

    test('should timeout waiting for message if none arrives', async () => {
      // Short timeout with no messages
      const arrived = await waitForMessage(queueUrl, 500)
      expect(arrived).toBe(false)
    })
  })

  describe('Queue Cleanup', () => {
    test('should drain all messages from queue', async () => {
      // Send multiple messages
      for (let i = 0; i < 3; i++) {
        await sendTestMessage(queueUrl, `Drain test ${i}`)
      }

      // Drain queue
      const drained = await drainQueue(queueUrl)
      expect(drained).toBe(3)

      // Queue should be empty
      const count = await getMessageCount(queueUrl)
      expect(count).toBe(0)
    })
  })
})
