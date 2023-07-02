import * as sinon from 'sinon'
import * as SNS from '../../../lib/vendor/AWS/SNS'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import * as chai from 'chai'
import {getFixture, testContext} from '../../../util/mocha-setup'
import {handler} from '../src'
import {APIGatewayEvent} from 'aws-lambda'
import {CreateEndpointResponse, ListSubscriptionsByTopicResponse, SubscribeResponse} from 'aws-sdk/clients/sns'
import {DocumentClient} from 'aws-sdk/lib/dynamodb/document_client'
import {UnexpectedError} from '../../../util/errors'
import {v4 as uuidv4} from 'uuid'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)
const fakeUserId = uuidv4()

/* eslint-disable  @typescript-eslint/no-non-null-assertion */
describe('#RegisterDevice', () => {
  const context = testContext
  let createPlatformEndpointStub: sinon.SinonStub
  let event: APIGatewayEvent
  let listSubscriptionsByTopicStub: sinon.SinonStub
  let subscribeStub: sinon.SinonStub
  let queryStub: sinon.SinonStub
  let unsubscribeStub: sinon.SinonStub
  let updateStub: sinon.SinonStub
  beforeEach(() => {
    createPlatformEndpointStub = sinon.stub(SNS, 'createPlatformEndpoint').returns(localFixture('createPlatformEndpoint-200-OK.json') as Promise<CreateEndpointResponse>)
    event = localFixture('APIGatewayEvent.json') as APIGatewayEvent
    listSubscriptionsByTopicStub = sinon.stub(SNS, 'listSubscriptionsByTopic').returns(localFixture('listSubscriptionsByTopic-200-OK.json') as Promise<ListSubscriptionsByTopicResponse>)
    subscribeStub = sinon.stub(SNS, 'subscribe').returns(localFixture('subscribe-200-OK.json') as Promise<SubscribeResponse>)
    queryStub = sinon.stub(DynamoDB, 'query').returns(localFixture('query-200-OK.json') as Promise<DocumentClient.QueryOutput>)
    unsubscribeStub = sinon.stub(SNS, 'unsubscribe')
    updateStub = sinon.stub(DynamoDB, 'updateItem')
    process.env.PlatformApplicationArn = 'arn:aws:sns:region:account_id:topic:uuid'
    process.env.PushNotificationTopicArn = 'arn:aws:sns:us-west-2:203465012143:PushNotifications'
  })
  afterEach(() => {
    createPlatformEndpointStub.restore()
    listSubscriptionsByTopicStub.restore()
    subscribeStub.restore()
    queryStub.restore()
    unsubscribeStub.restore()
    updateStub.restore()
  })
  it('(anonymous) should create an endpoint and subscribe to the unregistered topic', async () => {
    event.requestContext.authorizer!.principalId = 'unknown'
    delete event.headers['Authorization']
    const output = await handler(event, context)
    const body = JSON.parse(output.body)
    expect(output.statusCode).to.equal(200)
    expect(body.body).to.have.property('endpointArn')
  })
  it('(unauthenticated) throw an error; need to be either anonymous or authenticated', async () => {
    event.requestContext.authorizer!.principalId = 'unknown'
    expect(handler(event, context)).to.be.rejectedWith(UnexpectedError)
  })
  it('(authenticated-first) should create an endpoint, store the device details, and unsubscribe from the unregistered topic (registered user, first)', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    queryStub.returns(localFixture('query-201-Created.json'))
    const output = await handler(event, context)
    const body = JSON.parse(output.body)
    expect(output.statusCode).to.equal(201)
    expect(body.body).to.have.property('endpointArn')
  })
  it('(authenticated-subsequent) should create an endpoint, check the device details, and return', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    const output = await handler(event, context)
    const body = JSON.parse(output.body)
    expect(output.statusCode).to.equal(200)
    expect(body.body).to.have.property('endpointArn')
  })
  it('should return a valid response if APNS is not configured', async () => {
    process.env.PlatformApplicationArn = ''
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(503)
  })
  it('should handle an invalid request (no token)', async () => {
    event.body = '{}'
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(400)
    const body = JSON.parse(output.body)
    expect(body.error.message).to.be.an('object')
    expect(body.error.message.token).to.be.an('array').to.have.lengthOf(1)
    expect(body.error.message.token[0]).to.have.string('token is required')
  })
  describe('#AWSFailure', () => {
    it('AWS.SNS.createPlatformEndpoint', async () => {
      createPlatformEndpointStub.rejects(undefined)
      expect(handler(event, context)).to.be.rejectedWith(UnexpectedError)
    })
    it('AWS.SNS.listSubscriptionsByTopic = undefined', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      queryStub.returns(localFixture('query-201-Created.json'))
      listSubscriptionsByTopicStub.returns(undefined)
      expect(handler(event, context)).to.be.rejectedWith(UnexpectedError)
    })
    it('AWS.SNS.listSubscriptionsByTopic = unexpected', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      queryStub.returns(localFixture('query-201-Created.json'))
      listSubscriptionsByTopicStub.returns({Subscriptions: []})
      expect(handler(event, context)).to.be.rejectedWith(UnexpectedError)
    })
  })
})
