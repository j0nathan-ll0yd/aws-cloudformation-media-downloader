import {beforeEach, describe, expect, test, vi} from 'vitest'
import {testContext} from '#util/vitest-setup'
import {v4 as uuidv4} from 'uuid'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'

const fakeUserId = uuidv4()

// Mock native Drizzle query functions
vi.mock('#entities/queries', () => ({
  upsertDevice: vi.fn(),
  upsertUserDevice: vi.fn()
}))

const getUserDevicesMock = vi.fn()
vi.mock('#lib/domain/device/device-service', () => ({
  getUserDevices: getUserDevicesMock, // fmt: multiline
  subscribeEndpointToTopic: vi.fn(),
  unsubscribeEndpointToTopic: vi.fn()
}))

const {default: createPlatformEndpointResponse} = await import('./fixtures/createPlatformEndpoint-200-OK.json', {assert: {type: 'json'}})
const {default: listSubscriptionsByTopicResponse} = await import('./fixtures/listSubscriptionsByTopic-200-OK.json', {assert: {type: 'json'}})
const {default: subscribeResponse} = await import('./fixtures/subscribe-200-OK.json', {assert: {type: 'json'}})
const {default: queryDefaultResponse} = await import('./fixtures/query-200-OK.json', {assert: {type: 'json'}})
const {default: querySuccessResponse} = await import('./fixtures/query-201-Created.json', {assert: {type: 'json'}})
const createPlatformEndpointMock = vi.fn()
const listSubscriptionsByTopicMock = vi.fn()
vi.mock('#lib/vendor/AWS/SNS', () => ({
  deleteEndpoint: vi.fn().mockReturnValue({ResponseMetadata: {RequestId: uuidv4()}}), // fmt: multiline
  subscribe: vi.fn().mockReturnValue(subscribeResponse),
  listSubscriptionsByTopic: listSubscriptionsByTopicMock,
  createPlatformEndpoint: createPlatformEndpointMock,
  unsubscribe: vi.fn()
}))

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')
import {upsertDevice, upsertUserDevice} from '#entities/queries'

describe('#RegisterDevice', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    getUserDevicesMock.mockReturnValue(queryDefaultResponse.Items || [])
    vi.mocked(upsertDevice).mockResolvedValue({} as ReturnType<typeof upsertDevice> extends Promise<infer T> ? T : never)
    vi.mocked(upsertUserDevice).mockResolvedValue({} as ReturnType<typeof upsertUserDevice> extends Promise<infer T> ? T : never)
    createPlatformEndpointMock.mockReturnValue(createPlatformEndpointResponse)
    listSubscriptionsByTopicMock.mockReturnValue(listSubscriptionsByTopicResponse)
    process.env.PLATFORM_APPLICATION_ARN = 'arn:aws:sns:region:account_id:topic:uuid'
    process.env.PUSH_NOTIFICATION_TOPIC_ARN = 'arn:aws:sns:us-west-2:203465012143:PushNotifications'
  })
  test('(anonymous) should create an endpoint and subscribe to the unregistered topic', async () => {
    event.requestContext.authorizer!.principalId = 'unknown'
    delete event.headers['Authorization']
    const output = await handler(event, context)
    const body = JSON.parse(output.body)
    expect(output.statusCode).toEqual(200)
    expect(body.body).toHaveProperty('endpointArn')
  })
  test('(unauthenticated) throw an error; need to be either anonymous or authenticated', async () => {
    event.requestContext.authorizer!.principalId = 'unknown'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)
  })
  test('(authenticated-first) should create an endpoint, store the device details, and unsubscribe from the unregistered topic (registered user, first)', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    getUserDevicesMock.mockReturnValue(querySuccessResponse.Items || [])
    const output = await handler(event, context)
    const body = JSON.parse(output.body)
    expect(output.statusCode).toEqual(201)
    expect(body.body).toHaveProperty('endpointArn')
  })
  test('(authenticated-subsequent) should create an endpoint, check the device details, and return', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    const output = await handler(event, context)
    const body = JSON.parse(output.body)
    expect(output.statusCode).toEqual(200)
    expect(body.body).toHaveProperty('endpointArn')
  })
  test('should return a valid response if APNS is not configured', async () => {
    // Set up as anonymous user (not unauthenticated) to test APNS config check
    delete event.headers['Authorization']
    event.requestContext.authorizer!.principalId = 'unknown'
    process.env.PLATFORM_APPLICATION_ARN = ''
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(503)
  })
  test('should handle an invalid request (no token)', async () => {
    // Set up as anonymous user to test validation
    delete event.headers['Authorization']
    event.requestContext.authorizer!.principalId = 'unknown'
    event.body = '{}'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(400)
    const body = JSON.parse(output.body)
    expect(typeof body.error.message).toEqual('object')
    expect(body.error.message).toHaveProperty('token')
  })
  describe('#AWSFailure', () => {
    test('AWS.SNS.createPlatformEndpoint', async () => {
      // Set up as anonymous user to test AWS failure
      delete event.headers['Authorization']
      event.requestContext.authorizer!.principalId = 'unknown'
      createPlatformEndpointMock.mockReturnValue(undefined)
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })
    test('AWS.SNS.listSubscriptionsByTopic = undefined', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      getUserDevicesMock.mockReturnValue(querySuccessResponse.Items || [])
      listSubscriptionsByTopicMock.mockReturnValue(undefined)
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })
    test('AWS.SNS.listSubscriptionsByTopic = unexpected', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      getUserDevicesMock.mockReturnValue(querySuccessResponse.Items || [])
      listSubscriptionsByTopicMock.mockReturnValue({Subscriptions: []})
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })
  })
})
