import type {APIGatewayProxyEventHeaders, APIGatewayProxyResult, Context} from 'aws-lambda'
import type {z} from 'zod'
import {CustomLambdaError} from '#lib/system/errors'
import {logDebug, logError} from '#lib/system/logging'
import {validateResponse} from '#lib/lambda/middleware/apiGateway'

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

/** @deprecated Use getErrorMessage instead. Kept for backwards compatibility. */
export function formatUnknownError(unknownVariable: unknown): string {
  return getErrorMessage(unknownVariable)
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
    logDebug('response ==', rawBody)
    return {body: JSON.stringify(rawBody), headers, statusCode} as APIGatewayProxyResult
  } else if (body) {
    const rawBody = {body, requestId: context.awsRequestId}
    logDebug('response ==', rawBody)
    return {body: JSON.stringify(rawBody), headers, statusCode} as APIGatewayProxyResult
  } else {
    logDebug('response ==', '')
    return {body: '', headers, statusCode} as APIGatewayProxyResult
  }
}

/**
 * Build an API Gateway error response from an Error object or unknown value.
 * Used by middleware for centralized error handling.
 *
 * @param context - AWS Lambda context for request ID
 * @param error - Error instance or unknown error value
 * @returns Formatted API Gateway error response
 */
export function buildErrorResponse(context: Context, error: Error | unknown): APIGatewayProxyResult {
  // Handle Error instances
  if (error instanceof Error) {
    const statusCode = error instanceof CustomLambdaError ? (error.statusCode || 500) : 500
    const message = error instanceof CustomLambdaError ? (error.errors || error.message) : error.message
    const errorCode = error instanceof CustomLambdaError ? error.code : undefined
    logError('buildErrorResponse', JSON.stringify(error))
    return formatResponse(context, statusCode, message, undefined, errorCode)
  }

  // Handle plain objects (e.g., Better Auth error responses like {status: 404, message: '...'})
  if (error && typeof error === 'object') {
    const errorObj = error as {status?: number; statusCode?: number; message?: string}
    const statusCode = errorObj.status || errorObj.statusCode || 500
    const message = errorObj.message || getErrorMessage(error)
    logError('buildErrorResponse (object)', JSON.stringify(error))
    return formatResponse(context, statusCode, message)
  }

  // Fallback for unknown error types
  logError('buildErrorResponse (unknown)', String(error))
  return formatResponse(context, 500, getErrorMessage(error))
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
