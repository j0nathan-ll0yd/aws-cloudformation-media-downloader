import {
  beforeEach,
  describe,
  expect,
  jest,
  test
} from '@jest/globals'
import {CloudFrontRequestEvent} from 'aws-lambda'
import {testContext} from '../../../util/jest-setup'
import * as crypto from 'crypto'

const { default: eventMock } = await import('./fixtures/CloudFrontRequestEvent.json', {
  assert: { type: 'json' }
})
const { handler } = await import('./../src')

describe('#CloudfrontMiddleware', () => {
  const context = testContext
  const apiKeyHeaderName = 'X-API-Key'
  const apiKeyQueryStringName = 'ApiKey'
  const apiKeyValue = crypto.randomBytes(24).toString('hex')
  let event: CloudFrontRequestEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock)) as CloudFrontRequestEvent
  })
  test('should handle a request with (header: present, querystring: blank)', async () => {
    const spyURLParamsHas = jest.spyOn(URLSearchParams.prototype, 'has')
    const spyURLParamsGet = jest.spyOn(URLSearchParams.prototype, 'get')
    event.Records[0].cf.request.querystring = ''
    event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()] = [{
      key: apiKeyHeaderName,
      value: apiKeyValue
    }]
    const output = await handler(event, context)
    expect(output.headers).toHaveProperty('x-api-key')
    expect(spyURLParamsHas).toHaveBeenCalledTimes(0)
    expect(spyURLParamsGet).toHaveBeenCalledTimes(0)
  })
  test('should handle a request with (header: blank, querystring: blank)', async () => {
    const spyURLParamsHas = jest.spyOn(URLSearchParams.prototype, 'has')
    const spyURLParamsGet = jest.spyOn(URLSearchParams.prototype, 'get')
    event.Records[0].cf.request.querystring = ''
    delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]
    const output = await handler(event, context)
    expect(output.headers!['x-api-key']).toBeUndefined()
    expect(spyURLParamsHas).toHaveBeenCalledTimes(1)
    expect(spyURLParamsGet).toHaveBeenCalledTimes(0)
  })
  test('should handle a request with (header: blank, querystring: present)', async () => {
    const spyURLParamsHas = jest.spyOn(URLSearchParams.prototype, 'has')
    const spyURLParamsGet = jest.spyOn(URLSearchParams.prototype, 'get')
    event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${apiKeyValue}`
    delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]
    const output = await handler(event, context)
    expect(output.headers).toHaveProperty('x-api-key')
    expect(spyURLParamsHas).toHaveBeenCalledTimes(1)
    expect(spyURLParamsGet).toHaveBeenCalledTimes(1)
  })
  test('should handle a request with (header: present, querystring: present)', async () => {
    const spyURLParamsHas = jest.spyOn(URLSearchParams.prototype, 'has')
    const spyURLParamsGet = jest.spyOn(URLSearchParams.prototype, 'get')
    event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${apiKeyValue}`
    event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()] = [{
      key: apiKeyHeaderName,
      value: apiKeyValue
    }]
    const output = await handler(event, context)
    expect(output.headers).toHaveProperty('x-api-key')
    expect(spyURLParamsHas).toHaveBeenCalledTimes(0)
    expect(spyURLParamsGet).toHaveBeenCalledTimes(0)
  })
})
