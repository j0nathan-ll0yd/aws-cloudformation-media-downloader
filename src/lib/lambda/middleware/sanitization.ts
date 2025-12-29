import type {MiddlewareObj} from '@middy/core'
import type {APIGatewayProxyEvent} from 'aws-lambda'
import type {SanitizationOptions} from '#types/lambda'

/**
 * XSS patterns to detect and remove from input strings.
 * These patterns cover common attack vectors including:
 * - Script tags (inline and external)
 * - Event handlers (onclick, onerror, etc.)
 * - JavaScript URLs
 * - Iframe injection
 */
const XSS_PATTERNS: RegExp[] = [
  // Script tags (with any content)
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  // JavaScript URLs
  /javascript\s*:/gi,
  // Event handlers (onclick, onerror, onload, etc.)
  /\bon\w+\s*=/gi,
  // Iframe tags
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  // Data URLs with javascript
  /data\s*:\s*text\/html/gi,
  // Expression() CSS
  /expression\s*\(/gi,
  // VBScript URLs
  /vbscript\s*:/gi
]

/**
 * Sanitizes a single string value by removing XSS vectors and control characters.
 *
 * @param value - String to sanitize
 * @param options - Sanitization configuration
 * @returns Sanitized string
 */
function sanitizeString(value: string, options: SanitizationOptions): string {
  let result = value

  // Strip HTML and XSS vectors
  if (options.stripHtml !== false) {
    // Remove XSS patterns
    for (const pattern of XSS_PATTERNS) {
      result = result.replace(pattern, '')
    }
    // Remove remaining HTML tags
    result = result.replace(/<[^>]*>/g, '')
  }

  // Strip control characters (except newlines, carriage returns, and tabs)
  if (options.stripControlChars !== false) {
    // eslint-disable-next-line no-control-regex -- intentionally matching control characters for sanitization
    result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  }

  // Truncate to max length
  if (options.maxLength && result.length > options.maxLength) {
    result = result.substring(0, options.maxLength)
  }

  return result
}

/**
 * Recursively sanitizes object values.
 * Handles nested objects and arrays, preserving structure while sanitizing string values.
 *
 * @param obj - Object or value to sanitize
 * @param options - Sanitization configuration
 * @param path - Current object path (for skip field matching)
 * @returns Sanitized object/value
 */
function sanitizeObject(obj: unknown, options: SanitizationOptions, path = ''): unknown {
  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj
  }

  // Handle strings
  if (typeof obj === 'string') {
    return sanitizeString(obj, options)
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item, i) => sanitizeObject(item, options, `${path}[${i}]`))
  }

  // Handle objects
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key
      // Skip specified fields
      if (options.skipFields?.includes(key)) {
        result[key] = value
      } else {
        result[key] = sanitizeObject(value, options, fullPath)
      }
    }
    return result
  }

  // Return primitives (numbers, booleans) unchanged
  return obj
}

/**
 * Middy middleware that sanitizes request body strings against XSS/injection attacks.
 *
 * Runs in the `before` phase to sanitize input before validation or processing.
 * Parses JSON body, recursively sanitizes string values, and re-serializes.
 *
 * Features:
 * - Removes script tags and event handlers
 * - Strips JavaScript/VBScript URLs
 * - Removes iframe injection attempts
 * - Strips control characters
 * - Configurable field skipping (for passwords, tokens)
 * - Optional string length limiting
 *
 * @param options - Sanitization configuration
 * @returns Middy middleware object
 *
 * @example
 * ```typescript
 * import middy from '@middy/core'
 * import {sanitizeInput} from '#lib/lambda/middleware/sanitization'
 * import {wrapApiHandler} from '#lib/lambda/middleware/api'
 *
 * export const handler = middy(wrapApiHandler(async ({event, context}) => {
 *   // Body is already sanitized
 *   const body = getPayloadFromEvent(event)
 *   return buildApiResponse(context, 200, body)
 * })).use(sanitizeInput({
 *   skipFields: ['token', 'password'],
 *   maxLength: 10000
 * }))
 * ```
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/TypeScript/Lambda-Middleware-Patterns#sanitizeInput | Usage Examples}
 */
export function sanitizeInput(options: SanitizationOptions = {}): MiddlewareObj<APIGatewayProxyEvent> {
  return {
    before: async (request) => {
      if (request.event.body && typeof request.event.body === 'string') {
        try {
          const parsed = JSON.parse(request.event.body)
          const sanitized = sanitizeObject(parsed, options)
          request.event.body = JSON.stringify(sanitized)
        } catch {
          // Invalid JSON - let validation middleware handle it
          // Don't modify the body if we can't parse it
        }
      }
    }
  }
}
