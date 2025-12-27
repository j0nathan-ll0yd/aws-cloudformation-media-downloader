/**
 * SNS Vendor Wrapper Integration Tests
 *
 * Tests the SNS vendor wrapper against LocalStack to verify:
 * - Platform application creation/deletion
 * - Platform endpoint creation/deletion
 * - Message publishing to endpoints
 * - Topic subscription management
 *
 * These tests validate that src/lib/vendor/AWS/SNS.ts works correctly
 * with real AWS SDK calls against LocalStack.
 */

process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'

import {afterAll, beforeAll, describe, expect, test} from '@jest/globals'
import {
  createTestEndpoint,
  createTestPlatformApplication,
  createTestTopic,
  deleteTestEndpoint,
  deleteTestPlatformApplication,
  deleteTestTopic,
  isEndpointEnabled,
  listTestEndpoints,
  publishToEndpoint,
  publishToTopic,
  subscribeQueueToTopic
} from '../helpers/sns-helpers'
import {createTestQueue, deleteTestQueue, getQueueArnFromUrl, receiveOneMessage} from '../helpers/sqs-helpers'

describe('SNS Vendor Wrapper Integration Tests', () => {
  const testTopicName = `test-topic-${Date.now()}`
  const testAppName = `test-app-${Date.now()}`
  let topicArn: string
  let platformAppArn: string

  beforeAll(async () => {
    // Create test resources
    topicArn = await createTestTopic(testTopicName)
    platformAppArn = await createTestPlatformApplication(testAppName)
  })

  afterAll(async () => {
    // Clean up test resources
    await deleteTestTopic(topicArn)
    await deleteTestPlatformApplication(platformAppArn)
  })

  describe('Topic Operations', () => {
    test('should create and retrieve topic ARN', () => {
      expect(topicArn).toContain('arn:aws:sns')
      expect(topicArn).toContain(testTopicName)
    })

    test('should publish message to topic', async () => {
      const messageId = await publishToTopic(topicArn, 'Test message')
      expect(messageId).toBeDefined()
      expect(typeof messageId).toBe('string')
    })
  })

  describe('Platform Application Operations', () => {
    test('should create platform application with valid ARN', () => {
      expect(platformAppArn).toContain('arn:aws:sns')
      expect(platformAppArn).toContain('APNS_SANDBOX')
      expect(platformAppArn).toContain(testAppName)
    })

    test('should create and list platform endpoints', async () => {
      const deviceToken = `test-device-token-${Date.now()}`
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken, 'test-user-data')

      expect(endpointArn).toContain('arn:aws:sns')
      expect(endpointArn).toContain('endpoint')

      // Verify endpoint is listed
      const endpoints = await listTestEndpoints(platformAppArn)
      expect(endpoints).toContain(endpointArn)

      // Verify endpoint is enabled
      const enabled = await isEndpointEnabled(endpointArn)
      expect(enabled).toBe(true)

      // Clean up
      await deleteTestEndpoint(endpointArn)
    })

    test('should publish to platform endpoint', async () => {
      const deviceToken = `test-publish-token-${Date.now()}`
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      // Publish to endpoint (LocalStack accepts but doesn't deliver)
      const messageId = await publishToEndpoint(endpointArn, JSON.stringify({
        aps: {alert: 'Test notification', sound: 'default'}
      }))

      expect(messageId).toBeDefined()

      await deleteTestEndpoint(endpointArn)
    })
  })

  describe('Topic-Queue Subscription (SNS-SQS Fanout)', () => {
    let testQueueUrl: string
    let fanoutTopicArn: string
    const fanoutTopicName = `test-fanout-${Date.now()}`
    const testQueueName = `test-queue-${Date.now()}`

    beforeAll(async () => {
      fanoutTopicArn = await createTestTopic(fanoutTopicName)
      testQueueUrl = await createTestQueue(testQueueName)
    })

    afterAll(async () => {
      await deleteTestQueue(testQueueUrl)
      await deleteTestTopic(fanoutTopicArn)
    })

    test('should subscribe SQS queue to SNS topic and receive messages', async () => {
      const queueArn = getQueueArnFromUrl(testQueueUrl)

      // Subscribe queue to topic
      const subscriptionArn = await subscribeQueueToTopic(fanoutTopicArn, queueArn)
      expect(subscriptionArn).toContain('arn:aws:sns')

      // Publish message to topic
      const testMessage = {event: 'test', timestamp: Date.now()}
      await publishToTopic(fanoutTopicArn, JSON.stringify(testMessage))

      // Receive message from queue (SNS wraps the message)
      const message = await receiveOneMessage(testQueueUrl, 10)

      expect(message).not.toBeNull()
      expect(message!.Body).toBeDefined()

      // SNS wraps messages in an envelope
      const envelope = JSON.parse(message!.Body!)
      expect(envelope.Type).toBe('Notification')
      expect(envelope.TopicArn).toBe(fanoutTopicArn)

      const receivedMessage = JSON.parse(envelope.Message)
      expect(receivedMessage.event).toBe('test')
    })
  })
})
