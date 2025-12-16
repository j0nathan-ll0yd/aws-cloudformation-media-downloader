/**
 * Lambda Handler Wrappers
 *
 * Provides consistent error handling, fixture logging, and response formatting
 * for API Gateway Lambda handlers. Eliminates duplicate try-catch boilerplate.
 */

import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {CustomAPIGatewayRequestAuthorizerEvent} from '#types/main'
import {lambdaErrorResponse, logIncomingFixture, logOutgoingFixture} from './lambda-helpers'

/**
 * Wraps an API Gateway Lambda handler with consistent error handling and fixture logging.
 *
 * Features:
 * - Automatic incoming/outgoing fixture logging for test generation
 * - Consistent error response formatting
 * - Reduces boilerplate in each Lambda handler
 *
 * @param handler - The handler function to wrap
 * @returns Wrapped handler with error handling and logging
 *
 * @example
 * ```typescript
 * export const handler = withXRay(wrapApiHandler(async (event, context) => {
 *   const {userId} = getUserDetailsFromEvent(event)
 *   const result = await someBusinessLogic(userId)
 *   return response(context, 200, result)
 * }))
 * ```
 */
export function wrapApiHandler(
  handler: (event: CustomAPIGatewayRequestAuthorizerEvent, context: Context) => Promise<APIGatewayProxyResult>
): (event: CustomAPIGatewayRequestAuthorizerEvent, context: Context) => Promise<APIGatewayProxyResult> {
  return async (event, context) => {
    logIncomingFixture(event)
    try {
      const result = await handler(event, context)
      logOutgoingFixture(result)
      return result
    } catch (error) {
      const errorResult = lambdaErrorResponse(context, error)
      logOutgoingFixture(errorResult)
      return errorResult
    }
  }
}
