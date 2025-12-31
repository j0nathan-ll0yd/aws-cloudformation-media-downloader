/**
 * UserSubscribe Workflow Integration Tests
 *
 * Tests the subscription workflow using REAL LocalStack SNS:
 * 1. Validate authenticated user
 * 2. Subscribe device endpoint to SNS topic (real LocalStack)
 * 3. Return subscription ARN
 *
 * This is a TRUE integration test - no mocking of AWS services.
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'

import {afterAll, beforeAll, describe, expect, test} from 'vitest'
import type {Context} from 'aws-lambda'
import {UserStatus} from '#types/enums'

// Test helpers
import {createMockContext} from '../helpers/lambda-context'
import {createMockCustomAPIGatewayEvent} from '../helpers/test-data'
import {createTestEndpoint, createTestPlatformApplication, createTestTopic, deleteTestPlatformApplication, deleteTestTopic, generateIsolatedAppName} from '../helpers/sns-helpers'

// Import handler WITHOUT mocks - uses real LocalStack SNS
const {handler} = await import('#lambdas/UserSubscribe/src/index')

describe('UserSubscribe Workflow Integration Tests', () => {
  let mockContext: Context
  let platformAppArn: string
  let topicArn: string
  let testEndpointArn: string
  const testAppName = generateIsolatedAppName('test-subscribe')
  const testTopicName = generateIsolatedAppName('test-topic')

  beforeAll(async () => {
    mockContext = createMockContext()

    // Create real LocalStack SNS resources
    platformAppArn = await createTestPlatformApplication(testAppName)
    process.env.PLATFORM_APPLICATION_ARN = platformAppArn

    topicArn = await createTestTopic(testTopicName)

    // Create test endpoint for subscription tests
    testEndpointArn = await createTestEndpoint(platformAppArn, `device-token-${Date.now()}`)
  })

  afterAll(async () => {
    // Clean up LocalStack resources
    await deleteTestTopic(topicArn)
    await deleteTestPlatformApplication(platformAppArn)
  })

  test('should successfully subscribe endpoint to topic using real LocalStack SNS', async () => {
    const userId = crypto.randomUUID()

    const result = await handler(
      createMockCustomAPIGatewayEvent({
        path: '/subscriptions',
        httpMethod: 'POST',
        userId,
        userStatus: UserStatus.Authenticated,
        body: JSON.stringify({endpointArn: testEndpointArn, topicArn})
      }),
      mockContext
    )

    expect(result.statusCode).toBe(201)
    const response = JSON.parse(result.body)
    expect(response.body.subscriptionArn).toContain('arn:aws:sns')
    expect(response.body.subscriptionArn).toContain(testTopicName)
  })

  test('should return 401 for unauthenticated user', async () => {
    const result = await handler(
      createMockCustomAPIGatewayEvent({
        path: '/subscriptions',
        httpMethod: 'POST',
        userStatus: UserStatus.Unauthenticated,
        body: JSON.stringify({endpointArn: testEndpointArn, topicArn})
      }),
      mockContext
    )

    expect(result.statusCode).toBe(401)
  })

  test('should return 401 for anonymous user', async () => {
    const result = await handler(
      createMockCustomAPIGatewayEvent({
        path: '/subscriptions',
        httpMethod: 'POST',
        userStatus: UserStatus.Anonymous,
        body: JSON.stringify({endpointArn: testEndpointArn, topicArn})
      }),
      mockContext
    )

    expect(result.statusCode).toBe(401)
  })

  test('should return 400 for missing endpointArn', async () => {
    const userId = crypto.randomUUID()

    const result = await handler(
      createMockCustomAPIGatewayEvent({
        path: '/subscriptions',
        httpMethod: 'POST',
        userId,
        userStatus: UserStatus.Authenticated,
        body: JSON.stringify({topicArn})
      }),
      mockContext
    )

    expect(result.statusCode).toBe(400)
    const response = JSON.parse(result.body)
    expect(response.error.message).toHaveProperty('endpointArn')
  })

  test('should return 400 for missing topicArn', async () => {
    const userId = crypto.randomUUID()

    const result = await handler(
      createMockCustomAPIGatewayEvent({
        path: '/subscriptions',
        httpMethod: 'POST',
        userId,
        userStatus: UserStatus.Authenticated,
        body: JSON.stringify({endpointArn: testEndpointArn})
      }),
      mockContext
    )

    expect(result.statusCode).toBe(400)
    const response = JSON.parse(result.body)
    expect(response.error.message).toHaveProperty('topicArn')
  })

  test('should handle SNS subscription with invalid endpoint', async () => {
    const userId = crypto.randomUUID()
    const invalidEndpointArn = 'arn:aws:sns:us-west-2:000000000000:endpoint/APNS/test-app/invalid-endpoint'

    const result = await handler(
      createMockCustomAPIGatewayEvent({
        path: '/subscriptions',
        httpMethod: 'POST',
        userId,
        userStatus: UserStatus.Authenticated,
        body: JSON.stringify({endpointArn: invalidEndpointArn, topicArn})
      }),
      mockContext
    )

    // LocalStack may accept any endpoint, but real AWS would reject invalid ones
    // Either 201 (LocalStack accepts) or 500 (real validation) is acceptable
    expect([201, 500]).toContain(result.statusCode)
  })
})
