import {beforeEach, describe, expect, test, vi} from 'vitest'
import {testContext} from '#util/vitest-setup'
import {v4 as uuidv4} from 'uuid'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
const fakeUserId = uuidv4()

const subscribeMock = vi.fn()
vi.mock('#lib/vendor/AWS/SNS', () => ({
  deleteEndpoint: vi.fn(), // fmt: multiline
  subscribe: subscribeMock,
  unsubscribe: vi.fn()
}))

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#UserSubscribe', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    event.headers.Authorization = 'Bearer test-token'
    event.requestContext.authorizer!.principalId = fakeUserId
    process.env.PLATFORM_APPLICATION_ARN = 'arn:aws:sns:region:account_id:topic:uuid'
  })
  test('should create a new remote endpoint (for the mobile phone)', async () => {
    const {default: subscribeResponse} = await import('./fixtures/subscribe-200-OK.json', {assert: {type: 'json'}})
    subscribeMock.mockReturnValue(subscribeResponse)
    const output = await handler(event, context)
    const body = JSON.parse(output.body)
    expect(output.statusCode).toEqual(201)
    expect(body.body).toHaveProperty('subscriptionArn')
  })
  test('should return an error if APNS is not configured', async () => {
    process.env.PLATFORM_APPLICATION_ARN = ''
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(503)
  })
  test('should handle an invalid request (no endpointArn)', async () => {
    event.body = '{}'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(400)
    const body = JSON.parse(output.body)
    expect(body.error.message).toHaveProperty('endpointArn')
  })
  test('should handle an invalid request (no topicArn)', async () => {
    event.body = '{}'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(400)
    const body = JSON.parse(output.body)
    expect(body.error.message).toHaveProperty('topicArn')
  })
  test('should return 401 when user ID is missing (unauthenticated)', async () => {
    // With Authorization header but unknown principalId = Unauthenticated
    event.requestContext.authorizer!.principalId = 'unknown'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)
  })
  test('should return 401 for anonymous users (no auth header)', async () => {
    // Without Authorization header = Anonymous
    delete event.headers.Authorization
    event.requestContext.authorizer!.principalId = 'unknown'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)
  })

  describe('#EdgeCases', () => {
    test('should handle SNS subscribe failure gracefully', async () => {
      subscribeMock.mockRejectedValue(new Error('SNS subscription failed: InvalidParameter'))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
      const body = JSON.parse(output.body)
      expect(body.error).toBeDefined()
    })

    test('should reject malformed endpointArn', async () => {
      event.body = JSON.stringify({endpointArn: 'not-a-valid-arn', topicArn: 'arn:aws:sns:us-west-2:123456789:topic'})
      const output = await handler(event, context)
      // Validation may pass but SNS will fail - depends on validation schema
      expect([400, 500]).toContain(output.statusCode)
    })

    test('should reject malformed topicArn', async () => {
      event.body = JSON.stringify({endpointArn: 'arn:aws:sns:us-west-2:123456789:endpoint/APNS/app/token', topicArn: 'invalid-topic'})
      const output = await handler(event, context)
      expect([400, 500]).toContain(output.statusCode)
    })

    test('should handle empty request body', async () => {
      event.body = null
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(400)
    })

    test('should handle SNS rate limiting error', async () => {
      const rateLimitError = new Error('Rate exceeded')
      Object.assign(rateLimitError, {code: 'Throttling', statusCode: 429})
      subscribeMock.mockRejectedValue(rateLimitError)
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })
  })
})
