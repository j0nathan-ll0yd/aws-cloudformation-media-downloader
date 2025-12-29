import type {MiddlewareObj} from '@middy/core'
import type {APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda'
import type {SecurityHeadersOptions} from '#types/lambda'

/**
 * Default security headers applied to all responses.
 * These provide baseline protection against common web vulnerabilities.
 */
const DEFAULT_HEADERS: Record<string, string> = {
  // CORS headers
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Correlation-Id',
  // Security headers
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cache-Control': 'no-store'
}

/**
 * Builds the final headers object from options and defaults.
 *
 * @param options - Security headers configuration
 * @returns Combined headers object
 */
function buildHeaders(options: SecurityHeadersOptions): Record<string, string> {
  const headers = {...DEFAULT_HEADERS}

  // CORS configuration
  if (options.corsOrigins) {
    const origins = Array.isArray(options.corsOrigins) ? options.corsOrigins.join(', ') : options.corsOrigins
    headers['Access-Control-Allow-Origin'] = origins
  }
  if (options.corsMethods) {
    headers['Access-Control-Allow-Methods'] = options.corsMethods
  }
  if (options.corsHeaders) {
    headers['Access-Control-Allow-Headers'] = options.corsHeaders
  }

  // Security configuration
  if (options.frameOptions) {
    headers['X-Frame-Options'] = options.frameOptions
  }
  if (options.csp) {
    headers['Content-Security-Policy'] = options.csp
  }

  // Merge custom headers (can override defaults)
  if (options.customHeaders) {
    Object.assign(headers, options.customHeaders)
  }

  return headers
}

/**
 * Middy middleware that adds security headers to all API Gateway responses.
 *
 * Runs in the `after` phase to add headers to successful responses,
 * and in the `onError` phase to ensure error responses also get headers.
 *
 * Features:
 * - Default CORS headers (configurable origins, methods, headers)
 * - X-Content-Type-Options: nosniff (prevents MIME sniffing)
 * - X-Frame-Options: DENY (prevents clickjacking)
 * - X-XSS-Protection: 1; mode=block (XSS filter)
 * - Strict-Transport-Security (HSTS for HTTPS)
 * - Cache-Control: no-store (prevents caching of sensitive data)
 * - Optional Content-Security-Policy
 * - Custom headers support
 *
 * Headers set by the handler take precedence over defaults.
 *
 * @param options - Security headers configuration
 * @returns Middy middleware object
 *
 * @example
 * ```typescript
 * import middy from '@middy/core'
 * import {securityHeaders} from '#lib/lambda/middleware/security-headers'
 * import {wrapApiHandler} from '#lib/lambda/middleware/api'
 *
 * export const handler = middy(wrapApiHandler(async ({event, context}) => {
 *   return buildApiResponse(context, 200, {data: 'result'})
 * })).use(securityHeaders({
 *   corsOrigins: ['https://app.example.com'],
 *   frameOptions: 'SAMEORIGIN'
 * }))
 * ```
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/TypeScript/Lambda-Middleware-Patterns#securityHeaders | Usage Examples}
 */
export function securityHeaders(options: SecurityHeadersOptions = {}): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> {
  const headers = buildHeaders(options)
  return {
    after: async (request) => {
      if (request.response) {
        // Merge headers, with handler headers taking precedence
        request.response.headers = {
          ...headers,
          ...request.response.headers
        }
      }
    },
    onError: async (request) => {
      // Also add headers to error responses
      if (request.response) {
        request.response.headers = {
          ...headers,
          ...request.response.headers
        }
      }
    }
  }
}
