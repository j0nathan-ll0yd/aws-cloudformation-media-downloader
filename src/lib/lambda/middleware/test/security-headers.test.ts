import {describe, expect, it} from 'vitest'
import type {APIGatewayProxyResult} from 'aws-lambda'

describe('Lambda:Middleware:SecurityHeaders', () => {
  // Helper to create a mock Middy request with response
  function createMockRequest(response?: Partial<APIGatewayProxyResult>): {response: APIGatewayProxyResult | undefined} {
    return {
      response: response
        ? {statusCode: response.statusCode ?? 200, body: response.body ?? '', headers: response.headers ?? {}}
        : undefined
    }
  }

  describe('securityHeaders', () => {
    describe('default headers', () => {
      it('should add default security headers to response', async () => {
        const {securityHeaders} = await import('../../middleware/security-headers')
        const middleware = securityHeaders()

        const request = createMockRequest({statusCode: 200, body: '{}'})

        await middleware.after?.(request as Parameters<NonNullable<ReturnType<typeof securityHeaders>['after']>>[0])

        expect(request.response?.headers?.['X-Content-Type-Options']).toBe('nosniff')
        expect(request.response?.headers?.['X-Frame-Options']).toBe('DENY')
        expect(request.response?.headers?.['X-XSS-Protection']).toBe('1; mode=block')
        expect(request.response?.headers?.['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains')
        expect(request.response?.headers?.['Cache-Control']).toBe('no-store')
      })

      it('should NOT add CORS headers (mobile-only API)', async () => {
        const {securityHeaders} = await import('../../middleware/security-headers')
        const middleware = securityHeaders()

        const request = createMockRequest({statusCode: 200, body: '{}'})

        await middleware.after?.(request as Parameters<NonNullable<ReturnType<typeof securityHeaders>['after']>>[0])

        // CORS headers are intentionally omitted for this mobile-only API
        expect(request.response?.headers?.['Access-Control-Allow-Origin']).toBeUndefined()
        expect(request.response?.headers?.['Access-Control-Allow-Methods']).toBeUndefined()
        expect(request.response?.headers?.['Access-Control-Allow-Headers']).toBeUndefined()
      })
    })

    describe('security configuration', () => {
      it('should use configured frameOptions', async () => {
        const {securityHeaders} = await import('../../middleware/security-headers')
        const middleware = securityHeaders({frameOptions: 'SAMEORIGIN'})

        const request = createMockRequest({statusCode: 200, body: '{}'})

        await middleware.after?.(request as Parameters<NonNullable<ReturnType<typeof securityHeaders>['after']>>[0])

        expect(request.response?.headers?.['X-Frame-Options']).toBe('SAMEORIGIN')
      })

      it('should add Content-Security-Policy when configured', async () => {
        const {securityHeaders} = await import('../../middleware/security-headers')
        const middleware = securityHeaders({csp: "default-src 'self'; script-src 'self' 'unsafe-inline'"})

        const request = createMockRequest({statusCode: 200, body: '{}'})

        await middleware.after?.(request as Parameters<NonNullable<ReturnType<typeof securityHeaders>['after']>>[0])

        expect(request.response?.headers?.['Content-Security-Policy']).toBe("default-src 'self'; script-src 'self' 'unsafe-inline'")
      })
    })

    describe('custom headers', () => {
      it('should add custom headers', async () => {
        const {securityHeaders} = await import('../../middleware/security-headers')
        const middleware = securityHeaders({customHeaders: {'X-Custom-Header': 'custom-value', 'X-Another-Header': 'another-value'}})

        const request = createMockRequest({statusCode: 200, body: '{}'})

        await middleware.after?.(request as Parameters<NonNullable<ReturnType<typeof securityHeaders>['after']>>[0])

        expect(request.response?.headers?.['X-Custom-Header']).toBe('custom-value')
        expect(request.response?.headers?.['X-Another-Header']).toBe('another-value')
      })

      it('should allow custom headers to override defaults', async () => {
        const {securityHeaders} = await import('../../middleware/security-headers')
        const middleware = securityHeaders({customHeaders: {'Cache-Control': 'max-age=3600'}})

        const request = createMockRequest({statusCode: 200, body: '{}'})

        await middleware.after?.(request as Parameters<NonNullable<ReturnType<typeof securityHeaders>['after']>>[0])

        expect(request.response?.headers?.['Cache-Control']).toBe('max-age=3600')
      })
    })

    describe('handler header precedence', () => {
      it('should not override headers set by handler', async () => {
        const {securityHeaders} = await import('../../middleware/security-headers')
        const middleware = securityHeaders()

        const request = createMockRequest({
          statusCode: 200,
          body: '{}',
          headers: {'X-Frame-Options': 'ALLOW-FROM https://trusted.com', 'Custom-Header': 'custom-value'}
        })

        await middleware.after?.(request as Parameters<NonNullable<ReturnType<typeof securityHeaders>['after']>>[0])

        // Handler's headers should take precedence
        expect(request.response?.headers?.['X-Frame-Options']).toBe('ALLOW-FROM https://trusted.com')
        expect(request.response?.headers?.['Custom-Header']).toBe('custom-value')
        // Default headers should still be added
        expect(request.response?.headers?.['X-Content-Type-Options']).toBe('nosniff')
      })
    })

    describe('error response handling', () => {
      it('should add headers to error responses', async () => {
        const {securityHeaders} = await import('../../middleware/security-headers')
        const middleware = securityHeaders()

        const request = createMockRequest({statusCode: 500, body: JSON.stringify({error: 'Internal Server Error'})})

        await middleware.onError?.(request as Parameters<NonNullable<ReturnType<typeof securityHeaders>['onError']>>[0])

        expect(request.response?.headers?.['X-Content-Type-Options']).toBe('nosniff')
        expect(request.response?.headers?.['X-Frame-Options']).toBe('DENY')
        expect(request.response?.headers?.['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains')
      })

      it('should add headers to 4xx error responses', async () => {
        const {securityHeaders} = await import('../../middleware/security-headers')
        const middleware = securityHeaders()

        const request = createMockRequest({statusCode: 400, body: JSON.stringify({error: 'Bad Request'})})

        await middleware.onError?.(request as Parameters<NonNullable<ReturnType<typeof securityHeaders>['onError']>>[0])

        expect(request.response?.headers?.['X-Content-Type-Options']).toBe('nosniff')
        expect(request.response?.headers?.['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains')
      })
    })

    describe('edge cases', () => {
      it('should handle undefined response', async () => {
        const {securityHeaders} = await import('../../middleware/security-headers')
        const middleware = securityHeaders()

        const request = createMockRequest()

        // Should not throw
        await middleware.after?.(request as Parameters<NonNullable<ReturnType<typeof securityHeaders>['after']>>[0])

        expect(request.response).toBeUndefined()
      })

      it('should handle response without headers', async () => {
        const {securityHeaders} = await import('../../middleware/security-headers')
        const middleware = securityHeaders()

        const request: {response: {statusCode: number; body: string; headers?: Record<string, string>}} = {response: {statusCode: 200, body: '{}'}}

        await middleware.after?.(request as Parameters<NonNullable<ReturnType<typeof securityHeaders>['after']>>[0])

        expect(request.response.headers?.['X-Content-Type-Options']).toBe('nosniff')
      })

      it('should handle empty options', async () => {
        const {securityHeaders} = await import('../../middleware/security-headers')
        const middleware = securityHeaders({})

        const request = createMockRequest({statusCode: 200, body: '{}'})

        await middleware.after?.(request as Parameters<NonNullable<ReturnType<typeof securityHeaders>['after']>>[0])

        // Should use all security defaults
        expect(request.response?.headers?.['X-Frame-Options']).toBe('DENY')
        expect(request.response?.headers?.['X-Content-Type-Options']).toBe('nosniff')
      })
    })
  })
})
