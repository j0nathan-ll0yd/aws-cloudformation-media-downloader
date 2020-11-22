import * as sinon from 'sinon'
import * as SNS from '../../../lib/vendor/AWS/SNS'
import axios from 'axios'
import chai from 'chai'
import MockAdapter from 'axios-mock-adapter'
import {getFixture} from '../../../util/mocha-setup'
import {handleDeviceRegistration} from '../src'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#handleRegisterDevice', () => {
  const context = localFixture('Context.json')
  let createPlatformEndpointStub
  let subscribeStub
  let event
  let mock
  beforeEach(() => {
    mock = new MockAdapter(axios)
    createPlatformEndpointStub = sinon.stub(SNS, 'createPlatformEndpoint')
    subscribeStub = sinon.stub(SNS, 'subscribe')
    event = localFixture('APIGatewayEvent.json')
    process.env.PlatformApplicationArn = 'arn:aws:sns:region:account_id:topic:uuid'
  })
  afterEach(() => {
    createPlatformEndpointStub.restore()
    subscribeStub.restore()
    event = localFixture('APIGatewayEvent.json')
    mock.reset()
  })
  it('should create a new remote endpoint (for the mobile phone)', async () => {
    createPlatformEndpointStub.returns(localFixture('createPlatformEndpoint-200-OK.json'))
    subscribeStub.returns(localFixture('subscribe-200-OK.json'))
    const output = await handleDeviceRegistration(event, context)
    const body = JSON.parse(output.body)
    expect(output.statusCode).to.equal(201)
    expect(body.body).to.have.property('endpointArn')
  })
  it('should return a valid response if APNS is not configured', async () => {
    process.env.PlatformApplicationArn = ''
    const output = await handleDeviceRegistration(event, context)
    expect(output.statusCode).to.equal(200)
    const body = JSON.parse(output.body)
    expect(body.body).to.have.property('endpointArn')
    expect(body.body.endpointArn).to.have.string('requires configuration')
  })
  it('should handle an invalid request (no token)', async () => {
    event.body = null
    const output = await handleDeviceRegistration(event, context)
    expect(output.statusCode).to.equal(400)
    const body = JSON.parse(output.body)
    expect(body.error.message).to.have.property('token')
    expect(body.error.message.token[0]).to.have.string('is required')
  })
  it('should fail gracefully if createPlatformEndpoint fails', async () => {
    createPlatformEndpointStub.rejects('Error')
    expect(handleDeviceRegistration(event, context)).to.be.rejectedWith(Error)
  })
})
