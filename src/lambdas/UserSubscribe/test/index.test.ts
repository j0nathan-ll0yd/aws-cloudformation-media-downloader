import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import {testContext} from '#util/jest-setup'
import {CustomAPIGatewayRequestAuthorizerEvent} from '#types/main'

const subscribeMock = jest.fn()
jest.unstable_mockModule('#lib/vendor/AWS/SNS', () => ({
  deleteEndpoint: jest.fn(), // fmt: multiline
  subscribe: subscribeMock
}))

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#UserSubscribe', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    process.env.PlatformApplicationArn = 'arn:aws:sns:region:account_id:topic:uuid'
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
    process.env.PlatformApplicationArn = ''
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(503)
  })
  test('should handle an invalid request (no token)', async () => {
    event.body = '{}'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(400)
    const body = JSON.parse(output.body)
    expect(body.error.message).toHaveProperty('endpointArn')
    expect(body.error.message.endpointArn[0]).toEqual('endpointArn is required')
  })
  test('should handle an invalid request (no topicArn)', async () => {
    event.body = '{}'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(400)
    const body = JSON.parse(output.body)
    expect(body.error.message).toHaveProperty('topicArn')
    expect(body.error.message.topicArn[0]).toEqual('topicArn is required')
  })
})
