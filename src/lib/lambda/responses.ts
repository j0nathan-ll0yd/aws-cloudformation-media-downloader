import type {APIGatewayProxyEventHeaders, APIGatewayProxyResult, Context} from 'aws-lambda'
import {CustomLambdaError, ValidationError} from '#lib/system/errors'
import {logDebug, logError} from '#lib/system/logging'

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
 * Converts a validation errors object to a human-readable string.
 * @param errors - Object mapping field names to arrays of error messages
 * @returns Formatted string like "field1: error1, field2: error2"
 * @example
 * formatValidationErrors({articleURL: ["is not a valid YouTube URL"]})
 * // Returns: "articleURL: is not a valid YouTube URL"
 */
export function formatValidationErrors(errors: Record<string, string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
    .join('; ')
}

/** @deprecated Use getErrorMessage instead. Kept for backwards compatibility. */
export function formatUnknownError(unknownVariable: unknown): string {
  return getErrorMessage(unknownVariable)
}

/**
 * Internal function to format API Gateway responses.
 * Automatically detects error vs success based on status code.
 * @param context - Lambda context for request ID
 * @param statusCode - HTTP status code
 * @param body - Response body (string for errors, object for success)
 * @param headers - Optional response headers
 * @param errorCode - Optional specific error code (defaults to generic based on status)
 */
function formatResponse(
  context: Context,
  statusCode: number,
  body?: string | object,
  headers?: APIGatewayProxyEventHeaders,
  errorCode?: string
): APIGatewayProxyResult {
  let code = 'custom-5XX-generic'
  let isError = false
  const statusCodeString = statusCode.toString()
  if (/^4/.test(statusCodeString)) {
    code = errorCode ?? 'custom-4XX-generic'
    isError = true
  } else if (/^5/.test(statusCodeString)) {
    code = errorCode ?? 'custom-5XX-generic'
    isError = true
  }
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
 * Build an API Gateway response from either a status code + body or an Error object.
 *
 * @param context - AWS Lambda context for request ID
 * @param statusCodeOrError - HTTP status code (number) or Error object
 * @param body - Response body for success responses
 * @returns Formatted API Gateway response
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/TypeScript/Lambda-Middleware-Patterns#buildApiResponse | Usage Examples}
 */
export function buildApiResponse(context: Context, statusCodeOrError: number | Error | unknown, body?: string | object): APIGatewayProxyResult {
  // If first arg is a number, use it as status code directly
  if (typeof statusCodeOrError === 'number') {
    return formatResponse(context, statusCodeOrError, body)
  }

  // Handle ValidationError with special formatting
  if (statusCodeOrError instanceof ValidationError) {
    const error = statusCodeOrError
    const statusCode = error.statusCode || 400
    // Log original error details for debugging
    logError('buildApiResponse (validation)', {
      message: error.message,
      errors: error.errors,
      statusCode
    })
    // Format validation errors object to human-readable string
    const message = error.errors
      ? formatValidationErrors(error.errors as Record<string, string[]>)
      : error.message
    return formatResponse(context, statusCode, message, undefined, 'validation-error')
  }

  // Handle other CustomLambdaError instances
  if (statusCodeOrError instanceof CustomLambdaError) {
    const error = statusCodeOrError
    const statusCode = error.statusCode || 500
    // If errors is an object (shouldn't happen for non-ValidationError), convert to string
    let message: string
    if (error.errors && typeof error.errors === 'object') {
      message = formatValidationErrors(error.errors as Record<string, string[]>)
    } else {
      message = error.message
    }
    logError('buildApiResponse', JSON.stringify(error))
    return formatResponse(context, statusCode, message)
  }

  // Handle other Error instances
  if (statusCodeOrError instanceof Error) {
    const error = statusCodeOrError
    logError('buildApiResponse', JSON.stringify(error))
    return formatResponse(context, 500, error.message)
  }

  // Handle plain objects (e.g., Better Auth error responses like {status: 404, message: '...'})
  if (statusCodeOrError && typeof statusCodeOrError === 'object') {
    const errorObj = statusCodeOrError as {status?: number; statusCode?: number; message?: string}
    const statusCode = errorObj.status || errorObj.statusCode || 500
    const message = errorObj.message || getErrorMessage(statusCodeOrError)
    logError('buildApiResponse (object)', JSON.stringify(statusCodeOrError))
    return formatResponse(context, statusCode, message)
  }

  // Fallback for unknown error types
  logError('buildApiResponse (unknown)', String(statusCodeOrError))
  return formatResponse(context, 500, getErrorMessage(statusCodeOrError))
}
