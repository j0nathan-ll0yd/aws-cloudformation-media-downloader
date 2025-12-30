/**
 * UserSubscribe Workflow Integration Tests
 *
 * Tests the subscription workflow against real services:
 * - SNS: Mocked for topic subscription
 *
 * Workflow:
 * 1. Validate authenticated user
 * 2. Subscribe device endpoint to SNS topic
 * 3. Return subscription ARN
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.PLATFORM_APPLICATION_ARN = 'arn:aws:sns:us-west-2:123456789012:app/APNS/test-app'

import {afterAll, afterEach, beforeAll, describe, expect, test, vi} from 'vitest'
import type {Context} from 'aws-lambda'
import {UserStatus} from '#types/enums'

// Test helpers
import {createMockContext} from '../helpers/lambda-context'
import {createMockCustomAPIGatewayEvent} from '../helpers/test-data'

// Mock SNS vendor wrapper
const subscribeMock = vi.fn()
vi.mock('#lib/vendor/AWS/SNS', () => ({subscribe: subscribeMock, deleteEndpoint: vi.fn(), unsubscribe: vi.fn()}))

// Import handler after mocks
const {handler} = await import('#lambdas/UserSubscribe/src/index')

describe('UserSubscribe Workflow Integration Tests', () => {
  let mockContext: Context

  beforeAll(() => {
    mockContext = createMockContext()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  afterAll(() => {
    // Cleanup
  })

  test('should successfully subscribe endpoint to topic', async () => {
    const userId = crypto.randomUUID()
    const endpointArn = 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/test-app/device-token'
    const topicArn = 'arn:aws:sns:us-west-2:123456789012:topic'
    const subscriptionArn = 'arn:aws:sns:us-west-2:123456789012:topic:subscription-id'

    subscribeMock.mockResolvedValue({SubscriptionArn: subscriptionArn})

    const result = await handler(
      createMockCustomAPIGatewayEvent({
        path: '/subscriptions',
        httpMethod: 'POST',
        userId,
        userStatus: UserStatus.Authenticated,
        body: JSON.stringify({endpointArn, topicArn})
      }),
      mockContext
    )

    expect(result.statusCode).toBe(201)
    const response = JSON.parse(result.body)
    expect(response.body.subscriptionArn).toBe(subscriptionArn)
  })

  test('should return 401 for unauthenticated user', async () => {
    const endpointArn = 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/test-app/device-token'
    const topicArn = 'arn:aws:sns:us-west-2:123456789012:topic'

    const result = await handler(
      createMockCustomAPIGatewayEvent({
        path: '/subscriptions',
        httpMethod: 'POST',
        userStatus: UserStatus.Unauthenticated,
        body: JSON.stringify({endpointArn, topicArn})
      }),
      mockContext
    )

    expect(result.statusCode).toBe(401)
    expect(subscribeMock).not.toHaveBeenCalled()
  })

  test('should return 401 for anonymous user', async () => {
    const endpointArn = 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/test-app/device-token'
    const topicArn = 'arn:aws:sns:us-west-2:123456789012:topic'

    const result = await handler(
      createMockCustomAPIGatewayEvent({
        path: '/subscriptions',
        httpMethod: 'POST',
        userStatus: UserStatus.Anonymous,
        body: JSON.stringify({endpointArn, topicArn})
      }),
      mockContext
    )

    expect(result.statusCode).toBe(401)
  })

  test('should return 400 for missing endpointArn', async () => {
    const userId = crypto.randomUUID()
    const topicArn = 'arn:aws:sns:us-west-2:123456789012:topic'

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
    const endpointArn = 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/test-app/device-token'

    const result = await handler(
      createMockCustomAPIGatewayEvent({
        path: '/subscriptions',
        httpMethod: 'POST',
        userId,
        userStatus: UserStatus.Authenticated,
        body: JSON.stringify({endpointArn})
      }),
      mockContext
    )

    expect(result.statusCode).toBe(400)
    const response = JSON.parse(result.body)
    expect(response.error.message).toHaveProperty('topicArn')
  })

  test('should handle SNS subscription failure', async () => {
    const userId = crypto.randomUUID()
    const endpointArn = 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/test-app/device-token'
    const topicArn = 'arn:aws:sns:us-west-2:123456789012:topic'

    subscribeMock.mockRejectedValue(new Error('SNS subscription failed'))

    const result = await handler(
      createMockCustomAPIGatewayEvent({
        path: '/subscriptions',
        httpMethod: 'POST',
        userId,
        userStatus: UserStatus.Authenticated,
        body: JSON.stringify({endpointArn, topicArn})
      }),
      mockContext
    )

    expect(result.statusCode).toBe(500)
  })
})
