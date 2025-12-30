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
import type {APIGatewayProxyEvent} from 'aws-lambda'

// Test helpers
import {closeTestDb, createAllTables, dropAllTables, insertUser, truncateAllTables} from '../helpers/postgres-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createTestEndpoint, createTestPlatformApplication, createTestTopic, deleteTestPlatformApplication, deleteTestTopic} from '../helpers/sns-helpers'

// Create test resources before importing handler
const testAppName = `test-subscribe-app-${Date.now()}`
const testTopicName = `test-subscribe-topic-${Date.now()}`
let platformAppArn: string
let topicArn: string

// Import handler after environment setup
const {handler} = await import('#lambdas/UserSubscribe/src/index')

/**
 * Creates an authenticated API Gateway event for UserSubscribe testing
 */
function createUserSubscribeEvent(userId: string, body: {endpointArn: string; topicArn: string}): APIGatewayProxyEvent {
  return {
    httpMethod: 'POST',
    path: '/subscriptions',
    headers: {Authorization: `Bearer test-token-${userId}`, 'Content-Type': 'application/json'},
    body: JSON.stringify(body),
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    multiValueHeaders: {},
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: {
        principalId: userId // This makes the request authenticated
      },
      httpMethod: 'POST',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null
      },
      path: '/subscriptions',
      protocol: 'HTTP/1.1',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/subscriptions',
      stage: 'test'
    },
    resource: '/subscriptions'
  }
}

/**
 * Creates an unauthenticated API Gateway event (no principalId)
 */
function createUnauthenticatedEvent(body: {endpointArn: string; topicArn: string}): APIGatewayProxyEvent {
  const event = createUserSubscribeEvent('unknown', body)
  event.requestContext.authorizer = {} // No principalId
  return event
}

/**
 * Creates an anonymous API Gateway event (no Authorization header)
 */
function createAnonymousEvent(body: {endpointArn: string; topicArn: string}): APIGatewayProxyEvent {
  const event = createUserSubscribeEvent('test-user', body)
  delete event.headers['Authorization']
  return event
}

describe('UserSubscribe Workflow Integration Tests', () => {
  beforeAll(async () => {
    // Create PostgreSQL tables
    await createAllTables()

    // Create LocalStack SNS resources
    platformAppArn = await createTestPlatformApplication(testAppName)
    topicArn = await createTestTopic(testTopicName)

    // Set environment variable for the Lambda
    process.env.PLATFORM_APPLICATION_ARN = platformAppArn
  })

  afterEach(async () => {
    // Clean up data between tests
    await truncateAllTables()
  })

  afterAll(async () => {
    // Clean up LocalStack SNS
    await deleteTestTopic(topicArn)
    await deleteTestPlatformApplication(platformAppArn)

    // Drop tables and close connection
    await dropAllTables()
    await closeTestDb()
  })

  describe('Successful Subscription', () => {
    test('should subscribe device endpoint to SNS topic', async () => {
      // Arrange: Create user and endpoint
      const userId = crypto.randomUUID()
      const deviceToken = `subscribe-token-${Date.now()}`

      await insertUser({userId, email: 'subscribe@example.com'})
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      // Act: Invoke handler
      const event = createUserSubscribeEvent(userId, {endpointArn, topicArn})
      const result = await handler(event as never, createMockContext())

      // Assert: Successful subscription
      expect(result.statusCode).toBe(201)

      const body = JSON.parse(result.body)
      expect(body.body.subscriptionArn).toBeDefined()
      expect(body.body.subscriptionArn).toContain('arn:aws:sns')
    })

    test('should handle already-subscribed endpoint gracefully', async () => {
      // Arrange: Create user, endpoint, and initial subscription
      const userId = crypto.randomUUID()
      const deviceToken = `already-subscribed-${Date.now()}`

      await insertUser({userId, email: 'already@example.com'})
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      // First subscription
      const event1 = createUserSubscribeEvent(userId, {endpointArn, topicArn})
      await handler(event1 as never, createMockContext())

      // Act: Subscribe again (should be idempotent or succeed)
      const event2 = createUserSubscribeEvent(userId, {endpointArn, topicArn})
      const result = await handler(event2 as never, createMockContext())

      // Assert: Should succeed (SNS handles duplicates gracefully)
      expect(result.statusCode).toBe(201)
    })

    test('should return subscription ARN in response', async () => {
      // Arrange: Create user and endpoint
      const userId = crypto.randomUUID()
      const deviceToken = `arn-token-${Date.now()}`

      await insertUser({userId, email: 'arn@example.com'})
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      // Act: Invoke handler
      const event = createUserSubscribeEvent(userId, {endpointArn, topicArn})
      const result = await handler(event as never, createMockContext())

      // Assert: Response contains valid subscription ARN
      const body = JSON.parse(result.body)
      expect(body.body.subscriptionArn).toMatch(/^arn:aws:sns:[\w-]+:\d+:.+:.+$/)
    })
  })

  describe('Invalid Requests', () => {
    test('should reject invalid endpoint ARN', async () => {
      // Arrange: Create user with invalid endpoint ARN
      const userId = crypto.randomUUID()
      await insertUser({userId, email: 'invalid-endpoint@example.com'})

      // Act: Invoke handler with invalid endpoint
      const event = createUserSubscribeEvent(userId, {endpointArn: 'invalid-arn-format', topicArn})
      const result = await handler(event as never, createMockContext())

      // Assert: Should fail validation
      expect(result.statusCode).toBeGreaterThanOrEqual(400)
    })

    test('should reject invalid topic ARN', async () => {
      // Arrange: Create user and valid endpoint
      const userId = crypto.randomUUID()
      const deviceToken = `invalid-topic-${Date.now()}`

      await insertUser({userId, email: 'invalid-topic@example.com'})
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      // Act: Invoke handler with invalid topic
      const event = createUserSubscribeEvent(userId, {endpointArn, topicArn: 'invalid-topic-arn'})
      const result = await handler(event as never, createMockContext())

      // Assert: Should fail
      expect(result.statusCode).toBeGreaterThanOrEqual(400)
    })

    test('should reject missing endpointArn', async () => {
      // Arrange: Create user
      const userId = crypto.randomUUID()
      await insertUser({userId, email: 'missing-endpoint@example.com'})

      // Act: Invoke handler with missing endpointArn
      const event = createUserSubscribeEvent(userId, {endpointArn: '', topicArn})
      const result = await handler(event as never, createMockContext())

      // Assert: Should fail validation
      expect(result.statusCode).toBeGreaterThanOrEqual(400)
    })

    test('should reject missing topicArn', async () => {
      // Arrange: Create user and endpoint
      const userId = crypto.randomUUID()
      const deviceToken = `missing-topic-${Date.now()}`

      await insertUser({userId, email: 'missing-topic@example.com'})
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      // Act: Invoke handler with missing topicArn
      const event = createUserSubscribeEvent(userId, {endpointArn, topicArn: ''})
      const result = await handler(event as never, createMockContext())

      // Assert: Should fail validation
      expect(result.statusCode).toBeGreaterThanOrEqual(400)
    })
  })

  describe('Authentication Enforcement', () => {
    test('should reject unauthenticated requests', async () => {
      // Arrange: Create endpoint but no auth
      const deviceToken = `unauth-token-${Date.now()}`
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      // Act: Invoke handler without principalId
      const event = createUnauthenticatedEvent({endpointArn, topicArn})
      const result = await handler(event as never, createMockContext())

      // Assert: Unauthorized
      expect(result.statusCode).toBe(401)
    })

    test('should reject anonymous requests', async () => {
      // Arrange: Create endpoint but no Authorization header
      const deviceToken = `anon-token-${Date.now()}`
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      // Act: Invoke handler without Authorization header
      const event = createAnonymousEvent({endpointArn, topicArn})
      const result = await handler(event as never, createMockContext())

      // Assert: Unauthorized
      expect(result.statusCode).toBe(401)
    })
  })

  describe('Platform Configuration', () => {
    test('should fail when PLATFORM_APPLICATION_ARN is not set', async () => {
      // Arrange: Temporarily unset platform config
      const originalArn = process.env.PLATFORM_APPLICATION_ARN
      delete process.env.PLATFORM_APPLICATION_ARN

      const userId = crypto.randomUUID()
      const deviceToken = `no-platform-${Date.now()}`

      await insertUser({userId, email: 'no-platform@example.com'})
      const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

      // Act: Invoke handler
      const event = createUserSubscribeEvent(userId, {endpointArn, topicArn})
      const result = await handler(event as never, createMockContext())

      // Assert: Service unavailable (503)
      expect(result.statusCode).toBe(503)

      // Cleanup: Restore platform config
      process.env.PLATFORM_APPLICATION_ARN = originalArn
    })
  })
})
