import type {
  APIGatewayProxyEventHeaders,
  APIGatewayProxyResult,
  APIGatewayRequestAuthorizerEvent,
  Context,
  CustomAuthorizerResult,
  S3Event,
  S3EventRecord,
  ScheduledEvent,
  SQSEvent,
  SQSRecord
} from 'aws-lambda'
import {getStandardUnit, putMetricData} from '#lib/vendor/AWS/CloudWatch'
import {CustomLambdaError, ServiceUnavailableError, UnauthorizedError} from './errors'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import type {MetricInput, UserEventDetails} from '#types/util'
import {UserStatus} from '#types/enums'
import {getOptionalEnv} from './env-validation'
import {logDebug, logError, logInfo} from './logging'

// Re-export logging functions for backwards compatibility
export { logDebug, logError, logInfo }

/**
 * Extracts a human-readable message from an unknown error value.
 * Used as fallback when error is not an Error instance.
 */
function getErrorMessage(error: unknown): string {
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
 */
function formatResponse(context: Context, statusCode: number, body?: string | object, headers?: APIGatewayProxyEventHeaders): APIGatewayProxyResult {
  let code = 'custom-5XX-generic'
  let isError = false
  const statusCodeString = statusCode.toString()
  if (/^4/.test(statusCodeString)) {
    code = 'custom-4XX-generic'
    isError = true
  } else if (/^5/.test(statusCodeString)) {
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
 * @example
 * // Success response
 * return buildApiResponse(context, 200, \{data: files\})
 *
 * // Error response with status code
 * return buildApiResponse(context, 404, 'File not found')
 *
 * // Error response from Error object (extracts status and message)
 * return buildApiResponse(context, new ValidationError('Invalid input'))
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
    logError('buildApiResponse', JSON.stringify(error))
    return formatResponse(context, statusCode, message)
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

/*#__PURE__*/
export function verifyPlatformConfiguration(): void {
  const platformApplicationArn = getOptionalEnv('PlatformApplicationArn', '')
  logInfo('process.env.PlatformApplicationArn <=', platformApplicationArn)
  if (!platformApplicationArn) {
    throw new ServiceUnavailableError('requires configuration')
  }
}

export function getUserDetailsFromEvent(event: CustomAPIGatewayRequestAuthorizerEvent): UserEventDetails {
  let principalId = 'unknown'
  // This should always be present, via the API Gateway
  /* c8 ignore else */
  if (event.requestContext.authorizer && event.requestContext.authorizer.principalId) {
    principalId = event.requestContext.authorizer.principalId
  }
  const userId = principalId === 'unknown' ? undefined : principalId
  const authHeader = event.headers['Authorization']
  let userStatus: UserStatus
  if (authHeader && userId) {
    userStatus = UserStatus.Authenticated
  } else if (authHeader) {
    userStatus = UserStatus.Unauthenticated
  } else {
    userStatus = UserStatus.Anonymous
  }
  logDebug('getUserDetailsFromEvent.userId', userId)
  logDebug('getUserDetailsFromEvent.userId.typeof', typeof userId)
  logDebug('getUserDetailsFromEvent.authHeader', authHeader)
  logDebug('getUserDetailsFromEvent.userStatus', userStatus.toString())
  return {userId, userStatus} as UserEventDetails
}

/**
 * Publish a custom CloudWatch metric
 * @param metricName - Name of the metric
 * @param value - Numeric value
 * @param unit - Unit of measurement (Seconds, Bytes, Count, etc.)
 * @param dimensions - Optional dimensions for filtering/grouping
 */
export async function putMetric(metricName: string, value: number, unit?: string, dimensions: {Name: string; Value: string}[] = []): Promise<void> {
  try {
    await putMetricData({
      Namespace: 'MediaDownloader',
      MetricData: [{MetricName: metricName, Value: value, Unit: getStandardUnit(unit), Timestamp: new Date(), Dimensions: dimensions}]
    })
    logDebug(`Published metric: ${metricName}`, {value, unit: unit || 'Count', dimensions})
  } catch (error) {
    // Don't fail Lambda execution if metrics fail
    logError('Failed to publish CloudWatch metric', {metricName, error})
  }
}

/**
 * Publish multiple metrics in a single API call for efficiency
 * @param metrics - Array of metrics to publish
 */
export async function putMetrics(metrics: MetricInput[]): Promise<void> {
  try {
    await putMetricData({
      Namespace: 'MediaDownloader',
      MetricData: metrics.map((m) => ({
        MetricName: m.name,
        Value: m.value,
        Unit: getStandardUnit(m.unit),
        Timestamp: new Date(),
        Dimensions: m.dimensions || []
      }))
    })
    logDebug(`Published ${metrics.length} metrics`, {metrics: metrics.map((m) => m.name)})
  } catch (error) {
    // Don't fail Lambda execution if metrics fail
    logError('Failed to publish CloudWatch metrics', error)
  }
}

/**
 * Sanitize data for test fixtures by removing sensitive fields
 * Recursively processes objects and arrays to redact PII and credentials
 * @param data - Data to sanitize
 * @returns Sanitized copy of data with sensitive fields redacted
 */
function sanitizeForTest(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForTest(item))
  }

  const sanitized: Record<string, unknown> = {...(data as Record<string, unknown>)}

  // Remove sensitive fields - case-insensitive patterns for comprehensive PII protection
  const sensitivePatterns = [
    /^authorization$/i, // fmt: multiline
    /^token$/i,
    /^deviceToken$/i,
    /^refreshToken$/i,
    /^accessToken$/i,
    /^password$/i,
    /^apiKey$/i,
    /^secret$/i,
    /^privateKey$/i,
    /^appleDeviceIdentifier$/i,
    /^email$/i,
    /^phoneNumber$/i,
    /^phone$/i,
    /^certificate$/i,
    /^ssn$/i,
    /^creditCard$/i
  ]

  for (const key in sanitized) {
    if (sensitivePatterns.some((pattern) => pattern.test(key))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeForTest(sanitized[key])
    }
  }

  return sanitized
}

/**
 * Log incoming request for fixture extraction from CloudWatch
 * Marks production requests for automated fixture generation
 *
 * Automatically detects the Lambda function name from AWS_LAMBDA_FUNCTION_NAME
 * environment variable (set by AWS Lambda runtime).
 *
 * @param event - Lambda event (API Gateway request)
 * @param fixtureType - Optional type identifier (auto-detected from Lambda name if not provided)
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Fixture-Extraction#fixture-logging-implementation | Fixture Logging Implementation}
 */
export function logIncomingFixture(event: unknown, fixtureType?: string): void {
  // Silence fixture logging during tests if LOG_LEVEL is SILENT
  if (getOptionalEnv('LOG_LEVEL', 'INFO').toUpperCase() === 'SILENT') {
    return
  }
  const detectedType = fixtureType || getOptionalEnv('AWS_LAMBDA_FUNCTION_NAME', 'UnknownLambda')
  console.log(JSON.stringify({__FIXTURE_MARKER__: 'INCOMING', fixtureType: detectedType, timestamp: Date.now(), data: sanitizeForTest(event)}))
}

/**
 * Log outgoing response for fixture extraction from CloudWatch
 * Marks production responses for automated fixture generation
 *
 * Automatically detects the Lambda function name from AWS_LAMBDA_FUNCTION_NAME
 * environment variable (set by AWS Lambda runtime).
 *
 * @param response - Lambda response
 * @param fixtureType - Optional type identifier (auto-detected from Lambda name if not provided)
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Fixture-Extraction#fixture-logging-implementation | Fixture Logging Implementation}
 */
export function logOutgoingFixture(response: unknown, fixtureType?: string): void {
  // Silence fixture logging during tests if LOG_LEVEL is SILENT
  if (getOptionalEnv('LOG_LEVEL', 'INFO').toUpperCase() === 'SILENT') {
    return
  }
  const detectedType = fixtureType || getOptionalEnv('AWS_LAMBDA_FUNCTION_NAME', 'UnknownLambda')
  console.log(JSON.stringify({__FIXTURE_MARKER__: 'OUTGOING', fixtureType: detectedType, timestamp: Date.now(), data: sanitizeForTest(response)}))
}

// ============================================================================
// Lambda Handler Wrappers
// ============================================================================

import type {
  ApiHandlerParams,
  AuthenticatedApiParams,
  AuthorizerParams,
  EventHandlerParams,
  LambdaInvokeHandlerParams,
  OptionalAuthApiParams,
  ScheduledHandlerParams,
  WrapperMetadata
} from '#types/lambda-wrappers'

/**
 * Wraps an API Gateway handler with automatic error handling and fixture logging.
 * Eliminates try-catch boilerplate and ensures consistent error responses.
 *
 * @param handler - Business logic that returns APIGatewayProxyResult or throws
 * @returns Wrapped handler with error handling and fixture logging
 *
 * @example
 * ```typescript
 * export const handler = withXRay(wrapApiHandler(async ({event, context}) => {
 *   // Business logic - just throw on error
 *   if (!valid) throw new UnauthorizedError('Invalid')
 *   return response(context, 200, data)
 * }))
 * ```
 */
export function wrapApiHandler<TEvent = CustomAPIGatewayRequestAuthorizerEvent>(
  handler: (params: ApiHandlerParams<TEvent>) => Promise<APIGatewayProxyResult>
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<APIGatewayProxyResult> {
  return async (event: TEvent, context: Context, metadata?: WrapperMetadata): Promise<APIGatewayProxyResult> => {
    const traceId = metadata?.traceId || context.awsRequestId
    logInfo('event <=', event as object)
    logIncomingFixture(event)
    try {
      const result = await handler({event, context, metadata: {traceId}})
      logOutgoingFixture(result)
      return result
    } catch (error) {
      const errorResult = buildApiResponse(context, error as Error)
      logOutgoingFixture(errorResult)
      return errorResult
    }
  }
}

/**
 * Wraps an API Gateway handler that REQUIRES authentication.
 * Rejects both Unauthenticated AND Anonymous users with 401.
 * Guarantees userId is available (non-optional string) in the handler.
 *
 * @param handler - Business logic with guaranteed userId
 * @returns Wrapped handler with authentication enforcement
 *
 * @example
 * ```typescript
 * export const handler = withXRay(wrapAuthenticatedHandler(
 *   async ({event, context, userId}) => {
 *     // userId is guaranteed to be a string - no null checks needed
 *     const files = await getFilesByUser(userId)
 *     return response(context, 200, files)
 *   }
 * ))
 * ```
 */
export function wrapAuthenticatedHandler<TEvent = CustomAPIGatewayRequestAuthorizerEvent>(
  handler: (params: AuthenticatedApiParams<TEvent>) => Promise<APIGatewayProxyResult>
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<APIGatewayProxyResult> {
  return async (event: TEvent, context: Context, metadata?: WrapperMetadata): Promise<APIGatewayProxyResult> => {
    const traceId = metadata?.traceId || context.awsRequestId
    logInfo('event <=', event as object)
    logIncomingFixture(event)
    try {
      const {userId, userStatus} = getUserDetailsFromEvent(event as CustomAPIGatewayRequestAuthorizerEvent)

      // Reject Unauthenticated (invalid token)
      if (userStatus === UserStatus.Unauthenticated) {
        throw new UnauthorizedError()
      }
      // Reject Anonymous (no token at all)
      if (userStatus === UserStatus.Anonymous) {
        throw new UnauthorizedError()
      }

      // At this point, userStatus is Authenticated, so userId is guaranteed
      const result = await handler({event, context, metadata: {traceId}, userId: userId as string})
      logOutgoingFixture(result)
      return result
    } catch (error) {
      const errorResult = buildApiResponse(context, error as Error)
      logOutgoingFixture(errorResult)
      return errorResult
    }
  }
}

/**
 * Wraps an API Gateway handler that allows Anonymous OR Authenticated users.
 * Rejects only Unauthenticated users (invalid token) with 401.
 * Provides userId and userStatus for handler to differentiate behavior.
 *
 * @param handler - Business logic with userId and userStatus
 * @returns Wrapped handler with optional authentication support
 *
 * @example
 * ```typescript
 * export const handler = withPowertools(wrapOptionalAuthHandler(
 *   async ({context, userId, userStatus}) => {
 *     if (userStatus === UserStatus.Anonymous) {
 *       return buildApiResponse(context, 200, [getDefaultFile()])
 *     }
 *     // userId is available for authenticated users
 *     const files = await getFilesByUser(userId as string)
 *     return buildApiResponse(context, 200, files)
 *   }
 * ))
 * ```
 */
export function wrapOptionalAuthHandler<TEvent = CustomAPIGatewayRequestAuthorizerEvent>(
  handler: (params: OptionalAuthApiParams<TEvent>) => Promise<APIGatewayProxyResult>
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<APIGatewayProxyResult> {
  return async (event: TEvent, context: Context, metadata?: WrapperMetadata): Promise<APIGatewayProxyResult> => {
    const traceId = metadata?.traceId || context.awsRequestId
    logInfo('event <=', event as object)
    logIncomingFixture(event)
    try {
      const {userId, userStatus} = getUserDetailsFromEvent(event as CustomAPIGatewayRequestAuthorizerEvent)

      // Reject only Unauthenticated (invalid token)
      if (userStatus === UserStatus.Unauthenticated) {
        throw new UnauthorizedError()
      }

      // Allow Anonymous and Authenticated through
      const result = await handler({event, context, metadata: {traceId}, userId, userStatus})
      logOutgoingFixture(result)
      return result
    } catch (error) {
      const errorResult = buildApiResponse(context, error as Error)
      logOutgoingFixture(errorResult)
      return errorResult
    }
  }
}

/**
 * Wraps an API Gateway custom authorizer with proper error propagation.
 * Lets `Error('Unauthorized')` propagate (→401), logs unexpected errors.
 *
 * @param handler - Authorizer business logic
 * @returns Wrapped authorizer handler
 *
 * @example
 * ```typescript
 * export const handler = withXRay(wrapAuthorizer(async ({event}) => {
 *   if (!valid) throw new Error('Unauthorized')  // → 401
 *   return generateAllow(userId, event.methodArn)
 * }))
 * ```
 */
export function wrapAuthorizer(
  handler: (params: AuthorizerParams) => Promise<CustomAuthorizerResult>
): (event: APIGatewayRequestAuthorizerEvent, context: Context, metadata?: WrapperMetadata) => Promise<CustomAuthorizerResult> {
  return async (event: APIGatewayRequestAuthorizerEvent, context: Context, metadata?: WrapperMetadata): Promise<CustomAuthorizerResult> => {
    const traceId = metadata?.traceId || context.awsRequestId
    logInfo('event <=', event)
    try {
      const result = await handler({event, context, metadata: {traceId}})
      logDebug('response ==', result)
      return result
    } catch (error) {
      // Let 'Unauthorized' errors propagate (API Gateway returns 401)
      if (error instanceof Error && error.message === 'Unauthorized') {
        throw error
      }
      // Log unexpected errors and rethrow
      logError('authorizer error', error)
      throw error
    }
  }
}

/**
 * Wraps an S3/SQS event handler with per-record error handling.
 * Processes all records even if some fail, logs errors per record.
 *
 * @param handler - Handler for individual records
 * @param options - Configuration with getRecords extractor function
 * @returns Wrapped handler that processes all records
 *
 * @example
 * ```typescript
 * export const handler = withXRay(wrapEventHandler(
 *   async ({record}) => {
 *     // Process single S3 record
 *     await processFile(record.s3.object.key)
 *   },
 *   {getRecords: s3Records}
 * ))
 * ```
 */
export function wrapEventHandler<TEvent, TRecord>(
  handler: (params: EventHandlerParams<TRecord>) => Promise<void>,
  options: {getRecords: (event: TEvent) => TRecord[]}
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<void> {
  return async (event: TEvent, context: Context, metadata?: WrapperMetadata): Promise<void> => {
    const traceId = metadata?.traceId || context.awsRequestId
    logInfo('event <=', event as object)
    const records = options.getRecords(event)
    const errors: Error[] = []

    for (const record of records) {
      try {
        await handler({record, context, metadata: {traceId}})
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        logError('record processing error', {record, error: err.message})
        errors.push(err)
      }
    }

    if (errors.length > 0) {
      logError(`${errors.length}/${records.length} records failed`, errors.map((e) => e.message))
    }
  }
}

/**
 * Wraps a CloudWatch scheduled event handler with logging.
 * Logs event and result, rethrows errors for CloudWatch visibility.
 *
 * @param handler - Scheduled event business logic
 * @returns Wrapped handler with logging
 *
 * @example
 * ```typescript
 * export const handler = withXRay(wrapScheduledHandler(async () => {
 *   // Scheduled task logic
 *   await pruneOldRecords()
 * }))
 * ```
 */
export function wrapScheduledHandler<TResult = void>(
  handler: (params: ScheduledHandlerParams) => Promise<TResult>
): (event: ScheduledEvent, context: Context, metadata?: WrapperMetadata) => Promise<TResult> {
  return async (event: ScheduledEvent, context: Context, metadata?: WrapperMetadata): Promise<TResult> => {
    const traceId = metadata?.traceId || context.awsRequestId
    logInfo('scheduled event <=', event)
    try {
      const result = await handler({event, context, metadata: {traceId}})
      logInfo('scheduled result =>', result as object)
      return result
    } catch (error) {
      logError('scheduled handler error', error)
      throw error
    }
  }
}

/**
 * Wraps a Lambda-to-Lambda invoke handler with logging and error handling.
 * Used for handlers invoked asynchronously by other Lambdas (e.g., StartFileUpload).
 * Provides consistent logging, fixture extraction, and error propagation.
 *
 * @param handler - Lambda invoke handler business logic
 * @returns Wrapped handler with logging and error handling
 *
 * @example
 * ```typescript
 * export const handler = withPowertools(wrapLambdaInvokeHandler(
 *   async ({event, context}) => {
 *     // Process the Lambda invocation event
 *     await processFile(event.fileId)
 *     return buildApiResponse(context, 200, {status: 'success'})
 *   }
 * ))
 * ```
 */
export function wrapLambdaInvokeHandler<TEvent, TResult>(
  handler: (params: LambdaInvokeHandlerParams<TEvent>) => Promise<TResult>
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<TResult> {
  return async (event: TEvent, context: Context, metadata?: WrapperMetadata): Promise<TResult> => {
    const traceId = metadata?.traceId || context.awsRequestId
    logInfo('event <=', event as object)
    logIncomingFixture(event)
    try {
      const result = await handler({event, context, metadata: {traceId}})
      logOutgoingFixture(result)
      return result
    } catch (error) {
      logError('lambda invoke handler error', error)
      throw error
    }
  }
}

/**
 * Convenience extractor for S3 event records
 */
export const s3Records = (event: S3Event): S3EventRecord[] => event.Records

/**
 * Convenience extractor for SQS event records
 */
export const sqsRecords = (event: SQSEvent): SQSRecord[] => event.Records

// ============================================================================
// Powertools Middleware Wrapper
// ============================================================================

import middy from '@middy/core'
import {injectLambdaContext, logger, logMetrics, metrics} from '#lib/vendor/Powertools'
import {initializeTracing} from '#lib/vendor/OpenTelemetry/sdk'

/**
 * Wraps a Lambda handler with AWS Powertools middleware stack.
 * Provides enhanced observability with structured logging, tracing, and metrics.
 *
 * Features:
 * - Structured JSON logging with automatic context enrichment
 * - OpenTelemetry tracing with AWS X-Ray integration
 * - Automatic cold start metric tracking
 * - Correlation IDs through all logs
 *
 * @param handler - Lambda handler function
 * @returns Wrapped handler with Powertools middleware
 *
 * @example
 * ```typescript
 * export const handler = withPowertools(wrapAuthenticatedHandler(
 *   async ({event, context, userId}) => {
 *     const files = await getFilesByUser(userId)
 *     return response(context, 200, files)
 *   }
 * ))
 * ```
 */
export function withPowertools<TEvent, TResult>(
  handler: (event: TEvent, context: Context) => Promise<TResult>
): (event: TEvent, context: Context) => Promise<TResult> {
  // Initialize OpenTelemetry tracing (idempotent - only runs once per cold start)
  initializeTracing()

  const middyHandler = middy(handler).use(injectLambdaContext(logger, {clearState: true}))

  // Only enable metrics middleware in non-test environments
  // This prevents "No application metrics to publish" warnings in Jest
  // where we typically verify metrics via AWS SDK mocks instead of EMF
  if (getOptionalEnv('NODE_ENV', 'development') !== 'test') {
    middyHandler.use(logMetrics(metrics, {captureColdStartMetric: true}))
  }

  return middyHandler as unknown as (event: TEvent, context: Context) => Promise<TResult>
}

// Re-export Powertools utilities for direct access
export {logger, metrics, MetricUnit} from '#lib/vendor/Powertools'
