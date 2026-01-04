/**
 * RefreshToken Lambda
 *
 * Refreshes a user session by extending the expiration time.
 * This allows users to stay logged in without re-authenticating.
 *
 * Request: POST with Authorization Bearer header, empty body
 * Response: 200 with token, expiresAt, sessionId; 401 for invalid session; 500 for errors
 */

import type {APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda'
import type {ApiHandlerParams} from '#types/lambda'
import {userLoginResponseSchema} from '#types/api-schema'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapApiHandler} from '#lib/lambda/middleware/api'
import {logDebug, logInfo} from '#lib/system/logging'
import {refreshSession, validateSessionToken} from '#lib/domain/auth/sessionService'
import {extractBearerToken} from '#lib/lambda/auth-helpers'

/**
 * Lambda handler for refreshing session tokens.
 *
 * Validates the current session token from the Authorization header,
 * extends the session expiration, and returns the updated expiration.
 *
 * @param event - API Gateway proxy event
 * @param context - Lambda context
 * @returns API Gateway proxy result with refreshed session info
 */
export const handler = withPowertools(wrapApiHandler(async ({event, context}: ApiHandlerParams<APIGatewayProxyEvent>): Promise<APIGatewayProxyResult> => {
  // Extract Bearer token from Authorization header
  const token = extractBearerToken(event.headers || {})

  // Validate the session token
  logDebug('RefreshToken: validating session token')
  const sessionPayload = await validateSessionToken(token)

  // Refresh the session (extend expiration)
  logDebug('RefreshToken: refreshing session', {sessionId: sessionPayload.sessionId})
  const {expiresAt} = await refreshSession(sessionPayload.sessionId)

  // Return success with updated session info
  const responseData = {
    token, // Same token, just extended expiration
    expiresAt: new Date(expiresAt).toISOString(),
    sessionId: sessionPayload.sessionId,
    userId: sessionPayload.userId
  }

  logInfo('RefreshToken: session refreshed successfully', {sessionId: sessionPayload.sessionId, expiresAt})

  return buildValidatedResponse(context, 200, responseData, userLoginResponseSchema)
}))
