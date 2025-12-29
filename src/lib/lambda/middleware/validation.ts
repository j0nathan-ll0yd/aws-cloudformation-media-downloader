import type {z} from 'zod'
import type {ValidatedApiParams, AuthenticatedValidatedParams, WrapperMetadata} from '#types/lambda'
import type {APIGatewayProxyResult, Context} from 'aws-lambda'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import {logIncomingFixture, logOutgoingFixture} from '#lib/system/observability'
import {buildApiResponse} from '../responses'
import {extractCorrelationId} from '../correlation'
import {getPayloadFromEvent} from './api-gateway'
import {validateSchema} from '#lib/validation/constraints'
import {ValidationError} from '#lib/system/errors'
import {logger} from '#lib/vendor/Powertools'
import {getUserDetailsFromEvent} from '../context'
import {UserStatus} from '#types/enums'
import {UnauthorizedError} from '#lib/system/errors'

/**
 * Wraps an API Gateway handler with automatic Zod-based request body validation.
 * Parses and validates the request body against the provided schema, passing the
 * typed body to the handler.
 *
 * @param schema - Zod schema to validate request body against
 * @param handler - Business logic that receives validated, typed body
 * @returns Wrapped handler with validation
 *
 * @example
 * ```typescript
 * import {wrapValidatedHandler} from '#lib/lambda/middleware/validation'
 * import {deviceSchema} from '#types/api-schema'
 *
 * export const handler = withPowertools(
 *   wrapValidatedHandler(deviceSchema, async ({context, body}) => {
 *     // body is typed as z.infer<typeof deviceSchema>
 *     return buildApiResponse(context, 200, {deviceId: body.deviceId})
 *   })
 * )
 * ```
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/TypeScript/Lambda-Middleware-Patterns#wrapValidatedHandler | Usage Examples}
 */
export function wrapValidatedHandler<TBody, TEvent = CustomAPIGatewayRequestAuthorizerEvent>(
  schema: z.ZodSchema<TBody>,
  handler: (params: ValidatedApiParams<TBody, TEvent>) => Promise<APIGatewayProxyResult>
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<APIGatewayProxyResult> {
  return async (event: TEvent, context: Context, metadata?: WrapperMetadata): Promise<APIGatewayProxyResult> => {
    const {traceId, correlationId} = metadata || extractCorrelationId(event, context)
    logger.appendKeys({correlationId, traceId})
    logIncomingFixture(event)
    try {
      const rawBody = getPayloadFromEvent(event as CustomAPIGatewayRequestAuthorizerEvent)
      const validationResult = validateSchema(schema, rawBody)
      if (validationResult?.errors) {
        throw new ValidationError('Bad Request', validationResult.errors)
      }
      const body = rawBody as TBody
      const result = await handler({event, context, metadata: {traceId, correlationId}, body})
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
 * Wraps an API Gateway handler with both authentication enforcement AND request validation.
 * Combines wrapAuthenticatedHandler and wrapValidatedHandler into a single wrapper for the
 * common pattern of authenticated endpoints that require request body validation.
 *
 * @param schema - Zod schema to validate request body against
 * @param handler - Business logic with guaranteed userId and validated body
 * @returns Wrapped handler with authentication and validation
 *
 * @example
 * ```typescript
 * import {wrapAuthenticatedValidatedHandler} from '#lib/lambda/middleware/validation'
 * import {deviceRegistrationSchema} from '#types/api-schema'
 *
 * export const handler = withPowertools(
 *   wrapAuthenticatedValidatedHandler(deviceRegistrationSchema, async ({context, userId, body}) => {
 *     // userId is guaranteed string, body is validated and typed
 *     const device = await registerDevice(userId, body.deviceId, body.token)
 *     return buildApiResponse(context, 200, {device})
 *   })
 * )
 * ```
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/TypeScript/Lambda-Middleware-Patterns#wrapAuthenticatedValidatedHandler | Usage Examples}
 */
export function wrapAuthenticatedValidatedHandler<TBody, TEvent = CustomAPIGatewayRequestAuthorizerEvent>(
  schema: z.ZodSchema<TBody>,
  handler: (params: AuthenticatedValidatedParams<TBody, TEvent>) => Promise<APIGatewayProxyResult>
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<APIGatewayProxyResult> {
  return async (event: TEvent, context: Context, metadata?: WrapperMetadata): Promise<APIGatewayProxyResult> => {
    const {traceId, correlationId} = metadata || extractCorrelationId(event, context)
    logger.appendKeys({correlationId, traceId})
    logIncomingFixture(event)
    try {
      // Authentication check first
      const {userId, userStatus} = getUserDetailsFromEvent(event as CustomAPIGatewayRequestAuthorizerEvent)

      if (userStatus === UserStatus.Unauthenticated) {
        throw new UnauthorizedError()
      }
      if (userStatus === UserStatus.Anonymous) {
        throw new UnauthorizedError()
      }

      // Then validate body
      const rawBody = getPayloadFromEvent(event as CustomAPIGatewayRequestAuthorizerEvent)
      const validationResult = validateSchema(schema, rawBody)
      if (validationResult?.errors) {
        throw new ValidationError('Bad Request', validationResult.errors)
      }
      const body = rawBody as TBody

      const result = await handler({
        event,
        context,
        metadata: {traceId, correlationId},
        userId: userId as string,
        body
      })
      logOutgoingFixture(result)
      return result
    } catch (error) {
      const errorResult = buildApiResponse(context, error as Error)
      logOutgoingFixture(errorResult)
      return errorResult
    }
  }
}
