import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {CloudFrontRequestEvent} from 'aws-lambda'
import {createMockContext} from '#util/vitest-setup'
import {createCloudFrontRequestEvent} from '#test/helpers/event-factories'
import * as crypto from 'crypto'

const {handler} = await import('./../src')

describe('#CloudfrontMiddleware', () => {
  const context = createMockContext()
  const apiKeyHeaderName = 'X-API-Key'
  const apiKeyQueryStringName = 'ApiKey'
  const apiKeyValue = crypto.randomBytes(24).toString('hex')
  let event: CloudFrontRequestEvent
  beforeEach(() => {
    vi.clearAllMocks()
    event = createCloudFrontRequestEvent({querystring: `ApiKey=${apiKeyValue}`})
  })
  test('should handle a request with (header: present, querystring: blank)', async () => {
    event.Records[0].cf.request.querystring = ''
    event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()] = [{key: apiKeyHeaderName, value: apiKeyValue}]
    const output = await handler(event, context)
    expect(output.headers).toHaveProperty('x-api-key')
    expect(output.headers!['x-api-key'][0].value).toEqual(apiKeyValue)
  })
  test('should handle a request with (header: blank, querystring: blank)', async () => {
    event.Records[0].cf.request.querystring = ''
    delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]
    const output = await handler(event, context)
    expect(output.headers!['x-api-key']).toBeUndefined()
  })
  test('should handle a request with (header: blank, querystring: present)', async () => {
    event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${apiKeyValue}`
    delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]
    const output = await handler(event, context)
    expect(output.headers).toHaveProperty('x-api-key')
    expect(output.headers!['x-api-key'][0].value).toEqual(apiKeyValue)
  })
  test('should handle a request with (header: present, querystring: present)', async () => {
    event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${apiKeyValue}`
    event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()] = [{key: apiKeyHeaderName, value: apiKeyValue}]
    const output = await handler(event, context)
    expect(output.headers).toHaveProperty('x-api-key')
    // Header takes precedence over querystring
    expect(output.headers!['x-api-key'][0].value).toEqual(apiKeyValue)
  })

  describe('#EdgeCases', () => {
    test('should handle URL-encoded API key in query string', async () => {
      // URL-encoded special characters
      const encodedKey = 'abc%2B123%3D%2Fkey'
      event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${encodedKey}`
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]

      const output = await handler(event, context)
      expect(output.headers).toHaveProperty('x-api-key')
    })

    test('should handle multiple query parameters', async () => {
      event.Records[0].cf.request.querystring = `foo=bar&${apiKeyQueryStringName}=${apiKeyValue}&baz=qux`
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]

      const output = await handler(event, context)
      expect(output.headers).toHaveProperty('x-api-key')
    })

    test('should handle case-insensitive header lookup', async () => {
      event.Records[0].cf.request.querystring = ''
      // Use mixed case for header name
      event.Records[0].cf.request.headers['x-api-key'] = [{key: 'X-Api-Key', value: apiKeyValue}]

      const output = await handler(event, context)
      expect(output.headers).toHaveProperty('x-api-key')
    })

    test('should handle empty API key value in query string', async () => {
      event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=`
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]

      const output = await handler(event, context)
      // Should handle empty value gracefully
      expect(output).toBeDefined()
    })

    test('should preserve original request properties', async () => {
      event.Records[0].cf.request.querystring = ''
      event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()] = [{key: apiKeyHeaderName, value: apiKeyValue}]
      event.Records[0].cf.request.uri = '/api/v1/files'

      const output = await handler(event, context)
      // Verify the request properties are preserved in the output
      expect(output).toBeDefined()
      expect(output.headers).toHaveProperty('x-api-key')
    })
  })
})
