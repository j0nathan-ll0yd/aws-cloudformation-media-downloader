import {CloudFrontResultResponse} from 'aws-lambda'
import * as sinon from 'sinon'
import {getFixture} from '../../../util/mocha-setup'
import chai from 'chai'
import {handler} from '../src'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#CloudfrontMiddleware', () => {
  const context = localFixture('Context.json')
  const dependencyModule = require('../../../util/secretsmanager-helpers')
  let verifyAccessTokenStub
  beforeEach(() => {
    verifyAccessTokenStub = sinon.stub(dependencyModule, 'verifyAccessToken')
      .returns(localFixture('verifyAccessToken-200-OK.json'))
  })
  afterEach(() => {
    verifyAccessTokenStub.restore()
  })
  it('should handle a valid Authorization header', async () => {
    const event = localFixture('APIGatewayEvent-200-OK.json')
    const output = await handler(event, context)
    expect(output.headers).to.have.property('x-user-Id')
  })
  it('should handle an empty Authorization header', async () => {
    const event = localFixture('APIGatewayEvent-403-Forbidden-Authorization.json')
    const output = await handler(event, context)
    expect(output.headers).to.not.have.property('x-user-Id')
  })
  it('should handle an invalid Authorization header', async () => {
    const event = localFixture('APIGatewayEvent-403-Forbidden-Authorization.json')
    const output = await handler(event, context)
    expect(output.headers).to.not.have.property('x-user-Id')
  })
  it('should handle an expired Authorization header', async () => {
    const event = localFixture('APIGatewayEvent-401-Unauthorized.json')
    const output = await handler(event, context) as CloudFrontResultResponse
    expect(output).to.have.property('status')
    expect(output.status).to.equal('401')
  })
  it('should handle a valid request (with API key)', async () => {
    const event = localFixture('APIGatewayEvent-200-OK.json')
    const output = await handler(event, context)
    expect(output.headers).to.have.property('x-api-key')
  })
  it('should handle a request without an API key', async () => {
    const event = localFixture('APIGatewayEvent-403-Forbidden-X-API-Key.json')
    const output = await handler(event, context)
    expect(output.headers).to.not.have.property('x-api-key')
  })
})
