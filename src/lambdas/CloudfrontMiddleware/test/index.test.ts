import {CloudFrontRequestEvent, CloudFrontResponse, CloudFrontResultResponse} from 'aws-lambda'
import * as sinon from 'sinon'
import {getFixture} from '../../../util/mocha-setup'
import chai from 'chai'
import {handler} from '../src'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#CloudfrontMiddleware', () => {
  const context = localFixture('Context.json')
  const dependencyModule = require('../../../util/secretsmanager-helpers')
  let event
  let verifyAccessTokenStub
  beforeEach(() => {
    event = localFixture('APIGatewayEvent-200-OK.json') as CloudFrontRequestEvent
    verifyAccessTokenStub = sinon.stub(dependencyModule, 'verifyAccessToken')
      .returns(localFixture('verifyAccessToken-200-OK.json'))
  })
  afterEach(() => {
    verifyAccessTokenStub.restore()
  })
  it('should handle a valid Authorization header', async () => {
    const output = await handler(event, context)
    expect(output.headers).to.have.property('x-user-Id')
  })
  it('should handle an empty Authorization header', async () => {
    delete event.Records[0].cf.request.headers.authorization
    const output = await handler(event, context)
    expect(output.headers).to.not.have.property('x-user-Id')
  })
  it('should handle an invalid Authorization header', async () => {
    event.Records[0].cf.request.headers.authorization[0].value = 'Invalid header'
    const output = await handler(event, context)
    expect(output.headers).to.not.have.property('x-user-Id')
  })
  it('should handle an expired Authorization header', async () => {
    verifyAccessTokenStub.throws('TokenExpiredError: jwt expired')
    const output = await handler(event, context) as CloudFrontResultResponse
    expect(output).to.have.property('status')
    expect(output.status).to.equal(401)
  })
  it('should handle a valid request (with API key)', async () => {
    const output = await handler(event, context)
    expect(output.headers).to.have.property('x-api-key')
  })
  it('should handle a request without an API key', async () => {
    event.Records[0].cf.request.querystring = ''
    const output = await handler(event, context)
    expect(output.headers).to.not.have.property('x-api-key')
  })
  it('should ignore the Authentication header for unauthenicated paths', async () => {
    event.Records[0].cf.request.uri = '/login'
    const output = await handler(event, context)
    expect(output.headers).to.not.have.property('x-user-Id')
  })
  it('should enforce the Authentication header for multiauthentication paths', async () => {
    // if the path supports requires authentication, enforce it
    event.Records[0].cf.request.uri = '/feedly'
    delete event.Records[0].cf.request.headers.authorization
    const output = await handler(event, context) as CloudFrontResponse
    expect(output).to.have.property('status')
    expect(output.status).to.equal(401)
  })
  it('should handle a test request if structured correctly', async () => {
    const reservedIp = '127.0.0.1'
    const request = event.Records[0].cf.request
    request.clientIp = request.origin.custom.customHeaders['x-reserved-client-ip'][0].value = reservedIp
    request.headers['user-agent'][0].value = 'localhost@lifegames'
    const output = await handler(event, context)
    expect(output.headers).to.have.property('x-user-Id')
    expect(output.headers['x-user-Id'][0].value).to.equal('abcdefgh-ijkl-mnop-qrst-uvwxyz123456')
  })
})
