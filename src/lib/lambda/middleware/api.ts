import type {ApiHandlerParams, AuthenticatedApiParams, OptionalAuthApiParams, WrapperMetadata} from '#types/lambda'
import type {APIGatewayProxyResult, Context} from 'aws-lambda'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import {logInfo} from '#lib/system/logging'
import {logIncomingFixture, logOutgoingFixture} from '#lib/system/observability'
import {buildApiResponse} from '../responses'
import {getUserDetailsFromEvent} from '../context'
import {UserStatus} from '#types/enums'
import {UnauthorizedError} from '#lib/system/errors'

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
