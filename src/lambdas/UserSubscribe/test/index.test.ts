import * as sinon from 'sinon'
import * as SNS from '../../../lib/vendor/AWS/SNS'
import chai from 'chai'
import { getFixture } from '../../../util/mocha-setup'
import { index } from '../src'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#handleUserSubscribe', () => {
  const context = localFixture('Context.json')
  let subscribeStub
  let event
  beforeEach(() => {
    subscribeStub = sinon.stub(SNS, 'subscribe')
    event = localFixture('APIGatewayEvent.json')
    process.env.PlatformApplicationArn = 'arn:aws:sns:region:account_id:topic:uuid'
  })
  afterEach(() => {
    subscribeStub.restore()
  })
  it('should create a new remote endpoint (for the mobile phone)', async () => {
    subscribeStub.returns(localFixture('subscribe-200-OK.json'))
    const output = await index(event, context)
    const body = JSON.parse(output.body)
    expect(output.statusCode).to.equal(201)
    expect(body.body).to.have.property('subscriptionArn')
  })
  it('should return an error if APNS is not configured', async () => {
    process.env.PlatformApplicationArn = ''
    const output = await index(event, context)
    expect(output.statusCode).to.equal(500)
    const body = JSON.parse(output.body)
    expect(body.error.code).to.have.string('custom-5XX-generic')
    expect(body.error.message).to.have.string('requires configuration')
  })
  it('should handle an invalid request (no token)', async () => {
    event.body = null
    const output = await index(event, context)
    expect(output.statusCode).to.equal(400)
    const body = JSON.parse(output.body)
    expect(body.error.message).to.have.property('endpoint')
    expect(body.error.message.endpoint[0]).to.have.string('is required')
  })
})
