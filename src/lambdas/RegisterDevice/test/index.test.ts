import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import {testContext} from '#util/jest-setup'
import {v4 as uuidv4} from 'uuid'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import {createElectroDBEntityMock} from '#test/helpers/electrodb-mock'
const fakeUserId = uuidv4()

const devicesMock = createElectroDBEntityMock()
jest.unstable_mockModule('#entities/Devices', () => ({Devices: devicesMock.entity}))

const userDevicesMock = createElectroDBEntityMock()
jest.unstable_mockModule('#entities/UserDevices', () => ({UserDevices: userDevicesMock.entity}))

const getUserDevicesMock = jest.fn()
jest.unstable_mockModule('#util/shared', () => ({
  getUserDevices: getUserDevicesMock, // fmt: multiline
  subscribeEndpointToTopic: jest.fn()
}))

const {default: createPlatformEndpointResponse} = await import('./fixtures/createPlatformEndpoint-200-OK.json', {assert: {type: 'json'}})
const {default: listSubscriptionsByTopicResponse} = await import('./fixtures/listSubscriptionsByTopic-200-OK.json', {assert: {type: 'json'}})
const {default: subscribeResponse} = await import('./fixtures/subscribe-200-OK.json', {assert: {type: 'json'}})
const {default: queryDefaultResponse} = await import('./fixtures/query-200-OK.json', {assert: {type: 'json'}})
const {default: querySuccessResponse} = await import('./fixtures/query-201-Created.json', {assert: {type: 'json'}})
const createPlatformEndpointMock = jest.fn()
const listSubscriptionsByTopicMock = jest.fn()
jest.unstable_mockModule('#lib/vendor/AWS/SNS', () => ({
  deleteEndpoint: jest.fn().mockReturnValue({ResponseMetadata: {RequestId: uuidv4()}}), // fmt: multiline
  subscribe: jest.fn().mockReturnValue(subscribeResponse),
  listSubscriptionsByTopic: listSubscriptionsByTopicMock,
  createPlatformEndpoint: createPlatformEndpointMock,
  unsubscribe: jest.fn()
}))

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#RegisterDevice', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    getUserDevicesMock.mockReturnValue(queryDefaultResponse.Items || [])
    devicesMock.mocks.upsert.go.mockResolvedValue({data: {}})
    userDevicesMock.mocks.create.mockResolvedValue({data: {}})
    createPlatformEndpointMock.mockReturnValue(createPlatformEndpointResponse)
    listSubscriptionsByTopicMock.mockReturnValue(listSubscriptionsByTopicResponse)
    process.env.PlatformApplicationArn = 'arn:aws:sns:region:account_id:topic:uuid'
    process.env.PushNotificationTopicArn = 'arn:aws:sns:us-west-2:203465012143:PushNotifications'
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
    process.env.PlatformApplicationArn = ''
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(503)
  })
  test('should handle an invalid request (no token)', async () => {
    event.body = '{}'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(400)
    const body = JSON.parse(output.body)
    expect(typeof body.error.message).toEqual('object')
    expect(body.error.message).toHaveProperty('token')
  })
  describe('#AWSFailure', () => {
    test('AWS.SNS.createPlatformEndpoint', async () => {
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
