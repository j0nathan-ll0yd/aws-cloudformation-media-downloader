import * as sinon from 'sinon'
import * as SNS from '../../../lib/vendor/AWS/SNS'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import chai from 'chai'
import {getFixture, testContext} from '../../../util/mocha-setup'
import {handler} from '../src'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#RegisterDevice', () => {
  const context = testContext
  let createPlatformEndpointStub
  let event
  let listSubscriptionsByTopicStub
  let subscribeStub
  let queryStub
  let unsubscribeStub
  let updateStub
  beforeEach(() => {
    createPlatformEndpointStub = sinon.stub(SNS, 'createPlatformEndpoint').returns(localFixture('createPlatformEndpoint-200-OK.json'))
    event = localFixture('APIGatewayEvent.json')
    listSubscriptionsByTopicStub = sinon.stub(SNS, 'listSubscriptionsByTopic').returns(localFixture('listSubscriptionsByTopic-200-OK.json'))
    subscribeStub = sinon.stub(SNS, 'subscribe').returns(localFixture('subscribe-200-OK.json'))
    queryStub = sinon.stub(DynamoDB, 'query').returns(localFixture('query-200-OK.json'))
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
  it('should create an endpoint and subscribe to the unregistered topic (unregistered user)', async () => {
    delete event.headers['X-User-Id']
    const output = await handler(event, context)
    const body = JSON.parse(output.body)
    expect(output.statusCode).to.equal(200)
    expect(body.body).to.have.property('endpointArn')
  })
  it('should create an endpoint, store the device details, and unsubscribe from the unregistered topic (registered user, first)', async () => {
    queryStub.returns(localFixture('query-201-Created.json'))
    const output = await handler(event, context)
    const body = JSON.parse(output.body)
    expect(output.statusCode).to.equal(201)
    expect(body.body).to.have.property('endpointArn')
  })
  it('should create an endpoint, check the device details, and return (registered device, subsequent)', async () => {
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
    event.body = null
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(400)
    const body = JSON.parse(output.body)
    expect(body.error.message).to.be.an('object')
    expect(body.error.message.token).to.be.an('array').to.have.lengthOf(1)
    expect(body.error.message.token[0]).to.have.string('token is required')
  })
  it('should fail gracefully if createPlatformEndpoint fails', async () => {
    createPlatformEndpointStub.rejects('Error')
    expect(handler(event, context)).to.be.rejectedWith(Error)
  })
})
