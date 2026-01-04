import type {ApiHandlerParams, AuthenticatedApiParams, OptionalAuthApiParams, WrapperMetadata} from '#types/lambda'
import type {APIGatewayProxyResult, Context} from 'aws-lambda'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'
import {logIncomingFixture, logOutgoingFixture} from '#lib/system/observability'
import {emitSuccessMetrics} from '#lib/system/errorMetrics'
import {buildErrorResponse} from '../responses'
import {getUserDetailsFromEvent} from '../context'
import {extractCorrelationId} from '../correlation'
import {UserStatus} from '#types/enums'
import {UnauthorizedError} from '#lib/system/errors'
import {logger} from '#lib/vendor/Powertools'

/**
 * Wraps an API Gateway handler with automatic error handling and fixture logging.
 * Eliminates try-catch boilerplate and ensures consistent error responses.
 *
 * @param handler - Business logic that returns APIGatewayProxyResult or throws
 * @returns Wrapped handler with error handling and fixture logging
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/TypeScript/Lambda-Middleware-Patterns#wrapApiHandler | Usage Examples}
 */
export function wrapApiHandler<TEvent = CustomAPIGatewayRequestAuthorizerEvent>(
  handler: (params: ApiHandlerParams<TEvent>) => Promise<APIGatewayProxyResult>
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<APIGatewayProxyResult> {
  return async (event: TEvent, context: Context, metadata?: WrapperMetadata): Promise<APIGatewayProxyResult> => {
    const {traceId, correlationId} = metadata || extractCorrelationId(event, context)
    logger.appendKeys({correlationId, traceId})
    logIncomingFixture(event)
    try {
      const result = await handler({event, context, metadata: {traceId, correlationId}})
      // Emit success metrics for 2xx responses
      if (result.statusCode >= 200 && result.statusCode < 300) {
        emitSuccessMetrics(context.functionName)
      }
      logOutgoingFixture(result)
      return result
    } catch (error) {
      const apiEvent = event as CustomAPIGatewayRequestAuthorizerEvent
      const errorResult = buildErrorResponse(context, error, {traceId, correlationId}, {path: apiEvent.path, httpMethod: apiEvent.httpMethod})
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
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/TypeScript/Lambda-Middleware-Patterns#wrapAuthenticatedHandler | Usage Examples}
 */
export function wrapAuthenticatedHandler<TEvent = CustomAPIGatewayRequestAuthorizerEvent>(
  handler: (params: AuthenticatedApiParams<TEvent>) => Promise<APIGatewayProxyResult>
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<APIGatewayProxyResult> {
  return async (event: TEvent, context: Context, metadata?: WrapperMetadata): Promise<APIGatewayProxyResult> => {
    const {traceId, correlationId} = metadata || extractCorrelationId(event, context)
    logger.appendKeys({correlationId, traceId})
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
      const result = await handler({event, context, metadata: {traceId, correlationId}, userId: userId as string})
      // Emit success metrics for 2xx responses
      if (result.statusCode >= 200 && result.statusCode < 300) {
        emitSuccessMetrics(context.functionName)
      }
      logOutgoingFixture(result)
      return result
    } catch (error) {
      const apiEvent = event as CustomAPIGatewayRequestAuthorizerEvent
      // Re-extract userId for error context (getUserDetailsFromEvent doesn't throw)
      const {userId: errorUserId} = getUserDetailsFromEvent(apiEvent)
      const errorResult = buildErrorResponse(context, error, {traceId, correlationId}, {
        userId: errorUserId,
        path: apiEvent.path,
        httpMethod: apiEvent.httpMethod
      })
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
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/TypeScript/Lambda-Middleware-Patterns#wrapOptionalAuthHandler | Usage Examples}
 */
export function wrapOptionalAuthHandler<TEvent = CustomAPIGatewayRequestAuthorizerEvent>(
  handler: (params: OptionalAuthApiParams<TEvent>) => Promise<APIGatewayProxyResult>
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<APIGatewayProxyResult> {
  return async (event: TEvent, context: Context, metadata?: WrapperMetadata): Promise<APIGatewayProxyResult> => {
    const {traceId, correlationId} = metadata || extractCorrelationId(event, context)
    logger.appendKeys({correlationId, traceId})
    logIncomingFixture(event)
    try {
      const {userId, userStatus} = getUserDetailsFromEvent(event as CustomAPIGatewayRequestAuthorizerEvent)

      // Reject only Unauthenticated (invalid token)
      if (userStatus === UserStatus.Unauthenticated) {
        throw new UnauthorizedError()
      }

      // Allow Anonymous and Authenticated through
      const result = await handler({event, context, metadata: {traceId, correlationId}, userId, userStatus})
      // Emit success metrics for 2xx responses
      if (result.statusCode >= 200 && result.statusCode < 300) {
        emitSuccessMetrics(context.functionName)
      }
      logOutgoingFixture(result)
      return result
    } catch (error) {
      const apiEvent = event as CustomAPIGatewayRequestAuthorizerEvent
      // Re-extract userId for error context (getUserDetailsFromEvent doesn't throw)
      const {userId: errorUserId} = getUserDetailsFromEvent(apiEvent)
      const errorResult = buildErrorResponse(context, error, {traceId, correlationId}, {
        userId: errorUserId,
        path: apiEvent.path,
        httpMethod: apiEvent.httpMethod
      })
      logOutgoingFixture(errorResult)
      return errorResult
    }
  }
}
