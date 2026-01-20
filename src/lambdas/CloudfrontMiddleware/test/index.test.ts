import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {CloudFrontRequest, CloudFrontRequestEvent} from 'aws-lambda'
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

  describe('#ErrorHandling', () => {
    test('should handle Records array with single record', async () => {
      // Verify single record is handled correctly
      event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${apiKeyValue}`
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]

      const output = await handler(event, context)
      expect(output).toBeDefined()
      expect(output.headers).toHaveProperty('x-api-key')
    })

    test('should handle request with no querystring property', async () => {
      // CloudFront always provides querystring but test defensive handling
      event.Records[0].cf.request.querystring = ''
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]

      const output = await handler(event, context)
      expect(output).toBeDefined()
      expect(output.headers!['x-api-key']).toBeUndefined()
    })

    test('should handle request with null-ish headers values', async () => {
      event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${apiKeyValue}`
      // Ensure headers object exists but x-api-key is undefined
      event.Records[0].cf.request.headers = {}

      const output = await handler(event, context)
      expect(output).toBeDefined()
      expect(output.headers).toHaveProperty('x-api-key')
    })

    test('should not throw on malformed query string', async () => {
      // Malformed but parseable by URLSearchParams
      event.Records[0].cf.request.querystring = '&&&ApiKey=value&&&'
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]

      const output = await handler(event, context)
      expect(output).toBeDefined()
      expect(output.headers!['x-api-key']?.[0]?.value).toEqual('value')
    })

    test('should handle query string with only special characters', async () => {
      event.Records[0].cf.request.querystring = '&=&=&'
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]

      const output = await handler(event, context)
      expect(output).toBeDefined()
      expect(output.headers!['x-api-key']).toBeUndefined()
    })
  })

  describe('#RequestStructure', () => {
    test('should preserve all request properties except x-api-key header modification', async () => {
      event.Records[0].cf.request.uri = '/api/v1/files'
      event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${apiKeyValue}&other=param`
      event.Records[0].cf.request.headers['host'] = [{key: 'Host', value: 'example.com'}]
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]

      const output = await handler(event, context) as CloudFrontRequest

      expect(output.uri).toEqual('/api/v1/files')
      expect(output.method).toBeDefined() // method preserved from original request (read-only)
      expect(output.querystring).toEqual(`${apiKeyQueryStringName}=${apiKeyValue}&other=param`)
      expect(output.headers['host']).toBeDefined()
    })

    test('should return same request object reference (in-place modification)', async () => {
      event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${apiKeyValue}`
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]

      const output = await handler(event, context)

      // Handler modifies request in place and returns it
      expect(output).toBe(event.Records[0].cf.request)
    })

    test('should format x-api-key header with correct CloudFront structure', async () => {
      event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${apiKeyValue}`
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]

      const output = await handler(event, context)

      // CloudFront header structure: array of {key, value} objects
      expect(output.headers!['x-api-key']).toHaveLength(1)
      expect(output.headers!['x-api-key'][0]).toEqual({key: 'X-API-Key', value: apiKeyValue})
    })

    test('should not modify unrelated headers', async () => {
      event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${apiKeyValue}`
      event.Records[0].cf.request.headers['authorization'] = [{key: 'Authorization', value: 'Bearer token123'}]
      event.Records[0].cf.request.headers['content-type'] = [{key: 'Content-Type', value: 'application/json'}]
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]

      const output = await handler(event, context)

      expect(output.headers!['authorization']).toEqual([{key: 'Authorization', value: 'Bearer token123'}])
      expect(output.headers!['content-type']).toEqual([{key: 'Content-Type', value: 'application/json'}])
    })
  })

  describe('#QueryStringParsing', () => {
    test('should handle first ApiKey when multiple exist', async () => {
      event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=first&${apiKeyQueryStringName}=second`
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]

      const output = await handler(event, context)

      // URLSearchParams.get() returns first value
      expect(output.headers!['x-api-key'][0].value).toEqual('first')
    })

    test('should handle query string with only ApiKey parameter', async () => {
      event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${apiKeyValue}`
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]

      const output = await handler(event, context)

      expect(output.headers!['x-api-key'][0].value).toEqual(apiKeyValue)
    })

    test('should handle plus signs as spaces in query parameters', async () => {
      // URLSearchParams treats + as space by default
      event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=test+key+value`
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]

      const output = await handler(event, context)

      // + is decoded to space by URLSearchParams
      expect(output.headers!['x-api-key'][0].value).toEqual('test key value')
    })

    test('should handle very long query strings', async () => {
      const longValue = 'a'.repeat(1000)
      event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${longValue}`
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]

      const output = await handler(event, context)

      expect(output.headers!['x-api-key'][0].value).toEqual(longValue)
    })

    test('should handle unicode characters in query string', async () => {
      const unicodeValue = '%E2%9C%93check' // ✓check URL-encoded
      event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${unicodeValue}`
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]

      const output = await handler(event, context)

      expect(output.headers!['x-api-key'][0].value).toEqual('✓check')
    })
  })

  describe('#CacheHeaders', () => {
    test('should not modify cache-control headers', async () => {
      event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${apiKeyValue}`
      event.Records[0].cf.request.headers['cache-control'] = [{key: 'Cache-Control', value: 'max-age=3600'}]
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]

      const output = await handler(event, context)

      expect(output.headers!['cache-control']).toEqual([{key: 'Cache-Control', value: 'max-age=3600'}])
    })

    test('should not add cache headers', async () => {
      event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${apiKeyValue}`
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]
      delete event.Records[0].cf.request.headers['cache-control']

      const output = await handler(event, context)

      // Handler should not add cache headers
      expect(output.headers!['cache-control']).toBeUndefined()
    })

    test('should preserve etag headers', async () => {
      event.Records[0].cf.request.querystring = `${apiKeyQueryStringName}=${apiKeyValue}`
      event.Records[0].cf.request.headers['if-none-match'] = [{key: 'If-None-Match', value: '"abc123"'}]
      delete event.Records[0].cf.request.headers[apiKeyHeaderName.toLowerCase()]

      const output = await handler(event, context)

      expect(output.headers!['if-none-match']).toEqual([{key: 'If-None-Match', value: '"abc123"'}])
    })
  })
})
