import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {testContext} from '#util/vitest-setup'
import {v4 as uuidv4} from 'uuid'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import {mockClient} from 'aws-sdk-client-mock'
import {DeleteEndpointCommand, SNSClient, SubscribeCommand, UnsubscribeCommand} from '@aws-sdk/client-sns'

const fakeUserId = uuidv4()

// Create SNS mock - intercepts all SNSClient.send() calls
const snsMock = mockClient(SNSClient)

// Type helper for aws-sdk-client-mock-vitest matchers
type AwsMockExpect = (
  mock: any // eslint-disable-line @typescript-eslint/no-explicit-any
) => {
  toHaveReceivedCommand: (cmd: unknown) => void
  toHaveReceivedCommandWith: (cmd: unknown, input: unknown) => void
  not: {toHaveReceivedCommand: (cmd: unknown) => void}
}
const expectMock = expect as unknown as AwsMockExpect

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#UserSubscribe', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    event.headers.Authorization = 'Bearer test-token'
    event.requestContext.authorizer!.principalId = fakeUserId
    snsMock.reset()
    process.env.PLATFORM_APPLICATION_ARN = 'arn:aws:sns:region:account_id:topic:uuid'

    // Configure SNS mock responses
    snsMock.on(SubscribeCommand).resolves({SubscriptionArn: 'arn:aws:sns:us-west-2:123456789:topic:uuid'})
    snsMock.on(UnsubscribeCommand).resolves({$metadata: {requestId: uuidv4()}})
    snsMock.on(DeleteEndpointCommand).resolves({$metadata: {requestId: uuidv4()}})
  })

  afterEach(() => {
    snsMock.reset()
  })

  test('should create a new remote endpoint (for the mobile phone)', async () => {
    const output = await handler(event, context)
    const body = JSON.parse(output.body)
    expect(output.statusCode).toEqual(201)
    expect(body.body).toHaveProperty('subscriptionArn')
    expectMock(snsMock).toHaveReceivedCommand(SubscribeCommand)
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
      snsMock.on(SubscribeCommand).rejects(new Error('SNS subscription failed: InvalidParameter'))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
      const body = JSON.parse(output.body)
      expect(body.error).toBeDefined()
    })

    test('should reject malformed endpointArn via SNS validation', async () => {
      event.body = JSON.stringify({endpointArn: 'not-a-valid-arn', topicArn: 'arn:aws:sns:us-west-2:123456789:topic'})
      // Simulate SNS rejecting invalid ARN format
      snsMock.on(SubscribeCommand).rejects(new Error('Invalid parameter: EndpointArn'))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })

    test('should reject malformed topicArn via SNS validation', async () => {
      event.body = JSON.stringify({endpointArn: 'arn:aws:sns:us-west-2:123456789:endpoint/APNS/app/token', topicArn: 'invalid-topic'})
      // Simulate SNS rejecting invalid topic ARN format
      snsMock.on(SubscribeCommand).rejects(new Error('Invalid parameter: TopicArn'))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })

    test('should handle empty request body', async () => {
      event.body = null
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(400)
    })

    test('should handle SNS rate limiting error', async () => {
      const rateLimitError = new Error('Rate exceeded')
      Object.assign(rateLimitError, {code: 'Throttling', statusCode: 429})
      snsMock.on(SubscribeCommand).rejects(rateLimitError)
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })
  })
})
