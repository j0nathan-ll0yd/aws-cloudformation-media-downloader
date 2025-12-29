import type {APIGatewayProxyEventHeaders, APIGatewayProxyResult, Context} from 'aws-lambda'
import {CustomLambdaError} from '#lib/system/errors'
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

  // Handle Error instances
  if (statusCodeOrError instanceof Error) {
    const error = statusCodeOrError
    const statusCode = error instanceof CustomLambdaError ? (error.statusCode || 500) : 500
    const message = error instanceof CustomLambdaError ? (error.errors || error.message) : error.message
    const errorCode = error instanceof CustomLambdaError ? error.code : undefined
    logError('buildApiResponse', JSON.stringify(error))
    return formatResponse(context, statusCode, message, undefined, errorCode)
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
