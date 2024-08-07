import {CloudFrontRequestEvent} from 'aws-lambda'
import {getFixture, testContext} from '../../../util/mocha-setup'
import * as chai from 'chai'
import {handler} from '../src/index'
import * as crypto from 'crypto'
import * as sinon from 'sinon'
const expect = chai.expect
import path from 'path'
import {fileURLToPath} from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const localFixture = getFixture.bind(null, __dirname)

describe('#CloudfrontMiddleware', () => {
  const context = testContext
  const apiKeyHeaderName = 'X-API-Key'
  const apiKeyQueryStringName = 'ApiKey'
  const apiKeyValue = crypto.randomBytes(24).toString('hex')
  let event: CloudFrontRequestEvent
  beforeEach(() => {
    event = localFixture('CloudFrontRequestEvent.json') as CloudFrontRequestEvent
  })
  afterEach(() => {
    sinon.restore()
  })
  it('should handle a request with (header: present, querystring: blank)', async () => {
    const spyURLParamsHas = sinon.spy(URLSearchParams.prototype, 'has')
    const spyURLParamsGet = sinon.spy(URLSearchParams.prototype, 'get')
    event.Records[0].cf.request.querystring = ''
    event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()] = [{key: apiKeyHeaderName, value: apiKeyValue}]
    const output = await handler(event, context)
    expect(output.headers).to.have.property('x-api-key')
    expect(spyURLParamsHas.callCount).to.eql(0)
    expect(spyURLParamsGet.callCount).to.eql(0)
  })
  it('should handle a request with (header: blank, querystring: blank)', async () => {
    const spyURLParamsHas = sinon.spy(URLSearchParams.prototype, 'has')
    const spyURLParamsGet = sinon.spy(URLSearchParams.prototype, 'get')
    event.Records[0].cf.request.querystring = ''
    delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]
    const output = await handler(event, context)
    expect(output.headers).to.not.have.property('x-api-key')
    expect(spyURLParamsHas.callCount).to.eql(1)
    expect(spyURLParamsGet.callCount).to.eql(0)
  })
  it('should handle a request with (header: blank, querystring: present)', async () => {
    const spyURLParamsHas = sinon.spy(URLSearchParams.prototype, 'has')
    const spyURLParamsGet = sinon.spy(URLSearchParams.prototype, 'get')
    event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${apiKeyValue}`
    delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]
    const output = await handler(event, context)
    expect(output.headers).to.have.property('x-api-key')
    expect(spyURLParamsHas.callCount).to.eql(1)
    expect(spyURLParamsGet.callCount).to.eql(1)
  })
  it('should handle a request with (header: present, querystring: present)', async () => {
    const spyURLParamsHas = sinon.spy(URLSearchParams.prototype, 'has')
    const spyURLParamsGet = sinon.spy(URLSearchParams.prototype, 'get')
    event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${apiKeyValue}`
    event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()] = [{key: apiKeyHeaderName, value: apiKeyValue}]
    const output = await handler(event, context)
    expect(output.headers).to.have.property('x-api-key')
    expect(spyURLParamsHas.callCount).to.eql(0)
    expect(spyURLParamsGet.callCount).to.eql(0)
  })
})
