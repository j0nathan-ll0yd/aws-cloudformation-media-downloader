import type {APIGatewayProxyEventHeaders, APIGatewayProxyResult, Context} from 'aws-lambda'
import type {z} from 'zod'
import {CustomLambdaError, DatabaseError} from '#lib/system/errors'
import {emitErrorMetrics} from '#lib/system/errorMetrics'
import {logDebug, logError} from '#lib/system/logging'
import {validateResponse} from '#lib/lambda/middleware/apiGateway'
import type {ErrorContext, RequestInfo} from '#types/errorContext'
import type {WrapperMetadata} from '#types/lambda'

/** SQL patterns that should never appear in client responses */
const SQL_PATTERNS = [
  /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b.*\b(FROM|INTO|SET|TABLE|WHERE)\b/i,
  /\bFailed query:/i,
  /\bparams?:\s*[^,]+,/i
]

/**
 * Sanitizes error messages to prevent SQL query leakage to clients.
 * Returns a generic message if SQL patterns are detected.
 */
function sanitizeErrorMessage(message: string): string {
  for (const pattern of SQL_PATTERNS) {
    if (pattern.test(message)) {
      return 'Database operation failed'
    }
  }
  return message
}

/**
 * Extracts a human-readable message from an unknown error value.
 * Used as fallback when error is not an Error instance.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

/**
 * Internal function to format API Gateway responses.
 * Automatically detects error vs success based on status code.
 * @param context - AWS Lambda context for request ID
 * @param statusCode - HTTP status code
 * @param body - Response body
 * @param headers - Optional HTTP headers
 * @param errorCode - Optional specific error code (e.g., 'VALIDATION_ERROR', 'UNAUTHORIZED')
 */
function formatResponse(
  context: Context,
  statusCode: number,
  body?: string | object,
  headers?: APIGatewayProxyEventHeaders,
  errorCode?: string
): APIGatewayProxyResult {
  let isError = false
  const statusCodeString = statusCode.toString()
  if (/^4/.test(statusCodeString)) {
    isError = true
  } else if (/^5/.test(statusCodeString)) {
    isError = true
  }
  // Use specific error code if provided, otherwise generate generic code based on status
  const code = errorCode || (statusCode >= 400 && statusCode < 500 ? 'custom-4XX-generic' : 'custom-5XX-generic')
  // Note: 3xx responses are treated as success (not wrapped in error format)
  if (isError) {
    const rawBody = {error: {code, message: body}, requestId: context.awsRequestId}
    logDebug('response =>', rawBody)
    return {body: JSON.stringify(rawBody), headers, statusCode} as APIGatewayProxyResult
  } else if (body) {
    const rawBody = {body, requestId: context.awsRequestId}
    logDebug('response =>', rawBody)
    return {body: JSON.stringify(rawBody), headers, statusCode} as APIGatewayProxyResult
  } else {
    logDebug('response =>', '')
    return {body: '', headers, statusCode} as APIGatewayProxyResult
  }
}

/**
 * Build an API Gateway error response from an Error object or unknown value.
 * Used by middleware for centralized error handling.
 *
 * @param context - AWS Lambda context for request ID
 * @param error - Error instance or unknown error value
 * @param metadata - Optional tracing metadata (correlationId, traceId)
 * @param requestInfo - Optional request information for context enrichment
 * @returns Formatted API Gateway error response
 */
export function buildErrorResponse(context: Context, error: Error | unknown, metadata?: WrapperMetadata, requestInfo?: RequestInfo): APIGatewayProxyResult {
  // Build error context for debugging and observability
  const errorContext: ErrorContext = {
    correlationId: metadata?.correlationId,
    traceId: metadata?.traceId || context.awsRequestId,
    userId: requestInfo?.userId,
    lambdaName: context.functionName,
    timestamp: new Date().toISOString(),
    path: requestInfo?.path,
    httpMethod: requestInfo?.httpMethod
  }

  // Handle Error instances
  if (error instanceof Error) {
    // Attach context to CustomLambdaError for downstream logging
    if (error instanceof CustomLambdaError) {
      error.withContext(errorContext)
    }

    const statusCode = error instanceof CustomLambdaError ? (error.statusCode || 500) : 500
    const errorCode = error instanceof CustomLambdaError ? error.code : undefined

    // Handle DatabaseError specially - log full details, return sanitized message
    if (error instanceof DatabaseError) {
      logError('buildErrorResponse', {
        message: error.message,
        errorType: 'DatabaseError',
        queryName: error.queryName,
        originalMessage: error.originalMessage,
        statusCode,
        context: errorContext
      })
      emitErrorMetrics(error, context.functionName)
      return formatResponse(context, statusCode, error.message, undefined, errorCode)
    }

    // For other errors, sanitize message to prevent SQL leakage
    const rawMessage = error instanceof CustomLambdaError ? (error.errors || error.message) : error.message
    const message = typeof rawMessage === 'string' ? sanitizeErrorMessage(rawMessage) : rawMessage

    // Log with full context (original message for debugging)
    logError('buildErrorResponse', {message: error.message, errorType: error.constructor.name, statusCode, context: errorContext})

    // Emit error metrics
    emitErrorMetrics(error, context.functionName)

    return formatResponse(context, statusCode, message, undefined, errorCode)
  }

  // Handle plain objects (e.g., Better Auth error responses like {status: 404, message: '...'})
  if (error && typeof error === 'object') {
    const errorObj = error as {status?: number; statusCode?: number; message?: string}
    const statusCode = errorObj.status || errorObj.statusCode || 500
    const rawMessage = errorObj.message || getErrorMessage(error)
    const message = sanitizeErrorMessage(rawMessage)
    logError('buildErrorResponse (object)', {error: errorObj, context: errorContext})
    // Emit metrics for object errors
    const plainError = new Error(rawMessage)
    plainError.name = 'ObjectError'
    emitErrorMetrics(plainError, context.functionName)
    return formatResponse(context, statusCode, message)
  }

  // Fallback for unknown error types
  const rawUnknownMessage = getErrorMessage(error)
  logError('buildErrorResponse (unknown)', {error: String(error), context: errorContext})
  // Emit metrics for unknown errors
  const unknownError = new Error(rawUnknownMessage)
  unknownError.name = 'UnknownError'
  emitErrorMetrics(unknownError, context.functionName)
  return formatResponse(context, 500, sanitizeErrorMessage(rawUnknownMessage))
}

/**
 * Build API Gateway response with optional schema validation.
 * Only validates success responses (2xx status codes).
 * Body is optional for 204 No Content responses.
 *
 * @param context - AWS Lambda context for request ID
 * @param statusCode - HTTP status code
 * @param body - Response body (optional for 204)
 * @param schema - Optional Zod schema to validate response
 * @returns Formatted API Gateway response
 */
export function buildValidatedResponse<T extends string | object>(
  context: Context,
  statusCode: number,
  body?: T,
  schema?: z.ZodSchema<T>
): APIGatewayProxyResult {
  if (schema && body && statusCode >= 200 && statusCode < 300) {
    validateResponse(body, schema)
  }
  return formatResponse(context, statusCode, body)
}
