import type {MiddlewareObj} from '@middy/core'
import type {APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda'
import type {SecurityHeadersOptions} from '#types/lambda'

/**
 * Default security headers applied to all responses.
 * These provide baseline protection against common web vulnerabilities.
 *
 * NOTE: CORS headers are intentionally omitted. This is a mobile-only API
 * (iOS app uses native HTTP) which doesn't require CORS. Omitting CORS
 * headers reduces attack surface by preventing browser-based cross-origin requests.
 */
const DEFAULT_HEADERS: Record<string, string> = {
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
 * - X-Content-Type-Options: nosniff (prevents MIME sniffing)
 * - X-Frame-Options: DENY (prevents clickjacking)
 * - X-XSS-Protection: 1; mode=block (XSS filter)
 * - Strict-Transport-Security (HSTS for HTTPS)
 * - Cache-Control: no-store (prevents caching of sensitive data)
 * - Optional Content-Security-Policy
 * - Custom headers support
 *
 * NOTE: CORS headers are intentionally omitted. This is a mobile-only API
 * (iOS app uses native HTTP) which doesn't require CORS.
 *
 * Headers set by the handler take precedence over defaults.
 *
 * @param options - Security headers configuration
 * @returns Middy middleware object
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Lambda-Middleware-Patterns#securityHeaders | Usage Examples}
 */
export function securityHeaders(options: SecurityHeadersOptions = {}): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> {
  const headers = buildHeaders(options)

  // Type guard to check if response is an API Gateway response (has statusCode)
  // This prevents adding headers to SQS, EventBridge, or other non-HTTP responses
  const isApiGatewayResponse = (response: unknown): response is APIGatewayProxyResult => {
    return response !== null && typeof response === 'object' && 'statusCode' in response
  }

  return {
    after: async (request) => {
      if (request.response && isApiGatewayResponse(request.response)) {
        // Merge headers, with handler headers taking precedence
        request.response.headers = {...headers, ...request.response.headers}
      }
    },
    onError: async (request) => {
      // Also add headers to error responses
      if (request.response && isApiGatewayResponse(request.response)) {
        request.response.headers = {...headers, ...request.response.headers}
      }
    }
  }
}
