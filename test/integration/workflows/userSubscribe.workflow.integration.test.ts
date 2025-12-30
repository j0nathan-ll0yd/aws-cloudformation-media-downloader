/**
 * UserSubscribe Workflow Integration Tests
 *
 * Tests SNS subscription workflow:
 * 1. Validate device endpoint exists
 * 2. Subscribe endpoint to topic
 *
 * Uses LocalStack SNS.
 *
 * @see src/lambdas/UserSubscribe/src/index.ts
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'

// Test helpers
import {closeTestDb, createAllTables, dropAllTables, insertUser, truncateAllTables} from '../helpers/postgres-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createTestEndpoint, createTestPlatformApplication, createTestTopic, deleteTestPlatformApplication, deleteTestTopic} from '../helpers/sns-helpers'
import {createMockAPIGatewayEvent} from '../helpers/test-data'

// Create test resources before importing handler
const testAppName = `test-subscribe-app-${Date.now()}`
const testTopicName = `test-subscribe-topic-${Date.now()}`
let platformAppArn: string
let topicArn: string

// Import handler after environment setup
const {handler} = await import('#lambdas/UserSubscribe/src/index')

describe('UserSubscribe Workflow Integration Tests', () => {
  beforeAll(async () => {
    await createAllTables()
    platformAppArn = await createTestPlatformApplication(testAppName)
    topicArn = await createTestTopic(testTopicName)
    process.env.PLATFORM_APPLICATION_ARN = platformAppArn
  })

  afterEach(async () => {
    await truncateAllTables()
  })

  afterAll(async () => {
    await deleteTestTopic(topicArn)
    await deleteTestPlatformApplication(platformAppArn)
    await dropAllTables()
    await closeTestDb()
  })

  describe('Successful Subscription', () => {
    test('should subscribe device endpoint to SNS topic', async () => {
      const userId = crypto.randomUUID()
      const deviceToken = `subscribe-token-${Date.now()}`

      await insertUser({userId, email: 'subscribe@example.com'})
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      const event = createMockAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/subscriptions',
        body: JSON.stringify({endpointArn, topicArn}),
        principalId: userId
      })
      const result = await handler(event as never, createMockContext())

      expect(result.statusCode).toBe(201)
      const body = JSON.parse(result.body)
      expect(body.body.subscriptionArn).toBeDefined()
      expect(body.body.subscriptionArn).toContain('arn:aws:sns')
    })

    test('should handle already-subscribed endpoint gracefully', async () => {
      const userId = crypto.randomUUID()
      const deviceToken = `already-subscribed-${Date.now()}`

      await insertUser({userId, email: 'already@example.com'})
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      const event1 = createMockAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/subscriptions',
        body: JSON.stringify({endpointArn, topicArn}),
        principalId: userId
      })
      await handler(event1 as never, createMockContext())

      const event2 = createMockAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/subscriptions',
        body: JSON.stringify({endpointArn, topicArn}),
        principalId: userId
      })
      const result = await handler(event2 as never, createMockContext())

      expect(result.statusCode).toBe(201)
    })

    test('should return subscription ARN in response', async () => {
      const userId = crypto.randomUUID()
      const deviceToken = `arn-token-${Date.now()}`

      await insertUser({userId, email: 'arn@example.com'})
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      const event = createMockAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/subscriptions',
        body: JSON.stringify({endpointArn, topicArn}),
        principalId: userId
      })
      const result = await handler(event as never, createMockContext())

      const body = JSON.parse(result.body)
      expect(body.body.subscriptionArn).toMatch(/^arn:aws:sns:[\w-]+:\d+:.+:.+$/)
    })
  })

  describe('Invalid Requests', () => {
    test('should reject invalid endpoint ARN', async () => {
      const userId = crypto.randomUUID()
      await insertUser({userId, email: 'invalid-endpoint@example.com'})

      const event = createMockAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/subscriptions',
        body: JSON.stringify({endpointArn: 'invalid-arn-format', topicArn}),
        principalId: userId
      })
      const result = await handler(event as never, createMockContext())

      expect(result.statusCode).toBeGreaterThanOrEqual(400)
    })

    test('should reject invalid topic ARN', async () => {
      const userId = crypto.randomUUID()
      const deviceToken = `invalid-topic-${Date.now()}`

      await insertUser({userId, email: 'invalid-topic@example.com'})
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      const event = createMockAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/subscriptions',
        body: JSON.stringify({endpointArn, topicArn: 'invalid-topic-arn'}),
        principalId: userId
      })
      const result = await handler(event as never, createMockContext())

      expect(result.statusCode).toBeGreaterThanOrEqual(400)
    })

    test('should reject missing endpointArn', async () => {
      const userId = crypto.randomUUID()
      await insertUser({userId, email: 'missing-endpoint@example.com'})

      const event = createMockAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/subscriptions',
        body: JSON.stringify({endpointArn: '', topicArn}),
        principalId: userId
      })
      const result = await handler(event as never, createMockContext())

      expect(result.statusCode).toBeGreaterThanOrEqual(400)
    })

    test('should reject missing topicArn', async () => {
      const userId = crypto.randomUUID()
      const deviceToken = `missing-topic-${Date.now()}`

      await insertUser({userId, email: 'missing-topic@example.com'})
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      const event = createMockAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/subscriptions',
        body: JSON.stringify({endpointArn, topicArn: ''}),
        principalId: userId
      })
      const result = await handler(event as never, createMockContext())

      expect(result.statusCode).toBeGreaterThanOrEqual(400)
    })
  })

  describe('Authentication Enforcement', () => {
    test('should reject unauthenticated requests', async () => {
      const deviceToken = `unauth-token-${Date.now()}`
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      const event = createMockAPIGatewayEvent({httpMethod: 'POST', path: '/subscriptions', body: JSON.stringify({endpointArn, topicArn})})
      const result = await handler(event as never, createMockContext())

      expect(result.statusCode).toBe(401)
    })

    test('should reject anonymous requests', async () => {
      const deviceToken = `anon-token-${Date.now()}`
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      const event = createMockAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/subscriptions',
        body: JSON.stringify({endpointArn, topicArn}),
        headers: {'Content-Type': 'application/json'}
      })
      const result = await handler(event as never, createMockContext())

      expect(result.statusCode).toBe(401)
    })
  })

  describe('Platform Configuration', () => {
    test('should fail when PLATFORM_APPLICATION_ARN is not set', async () => {
      const originalArn = process.env.PLATFORM_APPLICATION_ARN
      delete process.env.PLATFORM_APPLICATION_ARN

      const userId = crypto.randomUUID()
      const deviceToken = `no-platform-${Date.now()}`

      await insertUser({userId, email: 'no-platform@example.com'})
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      const event = createMockAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/subscriptions',
        body: JSON.stringify({endpointArn, topicArn}),
        principalId: userId
      })
      const result = await handler(event as never, createMockContext())

      expect(result.statusCode).toBe(503)
      process.env.PLATFORM_APPLICATION_ARN = originalArn
    })
  })
})
