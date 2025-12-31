import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {testContext} from '#util/vitest-setup'
import {v4 as uuidv4} from 'uuid'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import {createAPIGatewayEvent, createSubscribeBody} from '#test/helpers/event-factories'
import {mockClient} from 'aws-sdk-client-mock'
import {DeleteEndpointCommand, SNSClient, SubscribeCommand, UnsubscribeCommand} from '@aws-sdk/client-sns'

const fakeUserId = uuidv4()

// Create SNS mock - intercepts all SNSClient.send() calls
const snsMock = mockClient(SNSClient)

const {handler} = await import('./../src')

describe('#UserSubscribe', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    // Create event with subscribe request body
    event = createAPIGatewayEvent({path: '/subscribe', httpMethod: 'POST', body: createSubscribeBody(), userId: fakeUserId})

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
    expect(snsMock).toHaveReceivedCommand(SubscribeCommand)
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
