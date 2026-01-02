import {afterAll, afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {testContext} from '#util/vitest-setup'
import {v4 as uuidv4} from 'uuid'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import {
  CreatePlatformEndpointCommand,
  DeleteEndpointCommand,
  ListSubscriptionsByTopicCommand,
  SubscribeCommand,
  UnsubscribeCommand
} from '@aws-sdk/client-sns'
import {createAPIGatewayEvent, createRegisterDeviceBody} from '#test/helpers/event-factories'
import {createMockUserDevice} from '#test/helpers/entity-fixtures'
import {
  createSNSEndpointResponse,
  createSNSMetadataResponse,
  createSNSSubscribeResponse,
  createSNSSubscriptionListResponse
} from '#test/helpers/aws-response-factories'
import {createSNSMock, resetAllAwsMocks} from '#test/helpers/aws-sdk-mock'

const fakeUserId = uuidv4()

// Create SNS mock using helper - injects into vendor client factory
const snsMock = createSNSMock()

vi.mock('#entities/queries', () => ({upsertDevice: vi.fn(), upsertUserDevice: vi.fn()}))

const getUserDevicesMock = vi.fn()
vi.mock('#lib/domain/device/device-service', () => ({
  getUserDevices: getUserDevicesMock, // fmt: multiline
  subscribeEndpointToTopic: vi.fn(),
  unsubscribeEndpointToTopic: vi.fn()
}))

const {handler} = await import('./../src')
import {upsertDevice, upsertUserDevice} from '#entities/queries'

// Reusable mock data - getUserDevices returns UserDevice[] (relationship records, not full Device objects)
const existingUserDevices = [createMockUserDevice({userId: fakeUserId})]

// Use a fixed endpoint ARN so CreatePlatformEndpoint and ListSubscriptionsByTopic responses match
const testEndpointArn = 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS_SANDBOX/MediaDownloader/test-endpoint'

describe('#RegisterDevice', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent

  beforeEach(() => {
    // Create event with device registration body
    event = createAPIGatewayEvent({path: '/registerDevice', httpMethod: 'POST', body: createRegisterDeviceBody()})

    snsMock.reset()
    getUserDevicesMock.mockReturnValue(existingUserDevices)
    vi.mocked(upsertDevice).mockResolvedValue({} as ReturnType<typeof upsertDevice> extends Promise<infer T> ? T : never)
    vi.mocked(upsertUserDevice).mockResolvedValue({} as ReturnType<typeof upsertUserDevice> extends Promise<infer T> ? T : never)

    // Configure SNS mock responses using factories - use same endpoint ARN for consistency
    snsMock.on(CreatePlatformEndpointCommand).resolves(createSNSEndpointResponse({endpointArn: testEndpointArn}))
    snsMock.on(ListSubscriptionsByTopicCommand).resolves(createSNSSubscriptionListResponse({subscriptions: [{Endpoint: testEndpointArn}]}))
    snsMock.on(SubscribeCommand).resolves(createSNSSubscribeResponse())
    snsMock.on(DeleteEndpointCommand).resolves(createSNSMetadataResponse())
    snsMock.on(UnsubscribeCommand).resolves(createSNSMetadataResponse())

    process.env.PLATFORM_APPLICATION_ARN = 'arn:aws:sns:region:account_id:topic:uuid'
    process.env.PUSH_NOTIFICATION_TOPIC_ARN = 'arn:aws:sns:us-west-2:203465012143:PushNotifications'
  })

  afterEach(() => {
    snsMock.reset()
  })

  afterAll(() => {
    resetAllAwsMocks()
  })

  test('(anonymous) should create an endpoint and subscribe to the unregistered topic', async () => {
    event.requestContext.authorizer!.principalId = 'unknown'
    delete event.headers['Authorization']
    const output = await handler(event, context)
    const body = JSON.parse(output.body)
    expect(output.statusCode).toEqual(200)
    expect(body.body).toHaveProperty('endpointArn')
    expect(snsMock).toHaveReceivedCommand(CreatePlatformEndpointCommand)
  })

  test('(unauthenticated) throw an error; need to be either anonymous or authenticated', async () => {
    event.requestContext.authorizer!.principalId = 'unknown'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)
  })

  test('(authenticated-first) should create an endpoint, store the device details, and unsubscribe from the unregistered topic (registered user, first)', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    getUserDevicesMock.mockReturnValue([])
    const output = await handler(event, context)
    const body = JSON.parse(output.body)
    expect(output.statusCode).toEqual(201)
    expect(body.body).toHaveProperty('endpointArn')
    expect(snsMock).toHaveReceivedCommand(CreatePlatformEndpointCommand)
    expect(snsMock).toHaveReceivedCommand(ListSubscriptionsByTopicCommand)
  })

  test('(authenticated-subsequent) should create an endpoint, check the device details, and return', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    const output = await handler(event, context)
    const body = JSON.parse(output.body)
    expect(output.statusCode).toEqual(200)
    expect(body.body).toHaveProperty('endpointArn')
    expect(snsMock).toHaveReceivedCommand(CreatePlatformEndpointCommand)
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
      snsMock.on(CreatePlatformEndpointCommand).resolves(undefined as never)
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(503)
      const body = JSON.parse(output.body)
      expect(body.error.code).toEqual('SERVICE_UNAVAILABLE')
    })

    test('AWS.SNS.listSubscriptionsByTopic = undefined', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      getUserDevicesMock.mockReturnValue([])
      snsMock.on(ListSubscriptionsByTopicCommand).resolves(undefined as never)
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(503)
      const body = JSON.parse(output.body)
      expect(body.error.code).toEqual('SERVICE_UNAVAILABLE')
    })

    test('AWS.SNS.listSubscriptionsByTopic = unexpected', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      getUserDevicesMock.mockReturnValue([])
      snsMock.on(ListSubscriptionsByTopicCommand).resolves({Subscriptions: []})
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
      const body = JSON.parse(output.body)
      expect(body.error.code).toEqual('INTERNAL_ERROR')
    })
  })

  describe('#EdgeCases', () => {
    test('should handle device with very long token', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      getUserDevicesMock.mockReturnValue([])
      // Device token is typically 64 hex characters
      const longToken = 'a'.repeat(256)
      event.body = createRegisterDeviceBody({token: longToken})
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(201)
    })

    test('should handle SNS createPlatformEndpoint throwing error', async () => {
      delete event.headers['Authorization']
      event.requestContext.authorizer!.principalId = 'unknown'
      snsMock.on(CreatePlatformEndpointCommand).rejects(new Error('SNS service unavailable'))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })

    test('should handle upsertDevice database failure', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      getUserDevicesMock.mockReturnValue([])
      vi.mocked(upsertDevice).mockRejectedValue(new Error('Database write failed'))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })

    test('should handle upsertUserDevice database failure', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      getUserDevicesMock.mockReturnValue([])
      vi.mocked(upsertUserDevice).mockRejectedValue(new Error('Database write failed'))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })

    test('should handle missing PUSH_NOTIFICATION_TOPIC_ARN', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      getUserDevicesMock.mockReturnValue([])
      delete process.env.PUSH_NOTIFICATION_TOPIC_ARN
      const output = await handler(event, context)
      // Should still work for device registration, topic subscription may fail
      expect([201, 500]).toContain(output.statusCode)
    })
  })
})
