import * as sinon from 'sinon'
import * as SNS from '../../../lib/vendor/AWS/SNS'
import * as chai from 'chai'
import {getFixture, testContext} from '../../../util/mocha-setup'
import {handler} from '../src'
import {APIGatewayEvent} from 'aws-lambda'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#UserSubscribe', () => {
  const context = testContext
  let subscribeStub: sinon.SinonStub
  let event: APIGatewayEvent
  beforeEach(() => {
    subscribeStub = sinon.stub(SNS, 'subscribe')
    event = localFixture('APIGatewayEvent.json') as APIGatewayEvent
    process.env.PlatformApplicationArn = 'arn:aws:sns:region:account_id:topic:uuid'
  })
  afterEach(() => {
    subscribeStub.restore()
  })
  it('should create a new remote endpoint (for the mobile phone)', async () => {
    subscribeStub.returns(localFixture('subscribe-200-OK.json'))
    const output = await handler(event, context)
    const body = JSON.parse(output.body)
    expect(output.statusCode).to.equal(201)
    expect(body.body).to.have.property('subscriptionArn')
  })
  it('should return an error if APNS is not configured', async () => {
    process.env.PlatformApplicationArn = ''
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(503)
  })
  it('should handle an invalid request (no token)', async () => {
    event.body = '{}'
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(400)
    const body = JSON.parse(output.body)
    expect(body.error.message).to.have.property('endpointArn')
    expect(body.error.message.endpointArn[0]).to.have.string('is required')
  })
  it('should handle an invalid request (no topicArn)', async () => {
    event.body = '{}'
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(400)
    const body = JSON.parse(output.body)
    expect(body.error.message).to.have.property('topicArn')
    expect(body.error.message.topicArn[0]).to.have.string('is required')
  })
})
