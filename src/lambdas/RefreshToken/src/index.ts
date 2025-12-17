/**
 * RefreshToken Lambda
 *
 * Refreshes a user session by extending the expiration time.
 * This allows users to stay logged in without re-authenticating.
 *
 * Request: POST with Authorization Bearer header, empty body
 * Response: 200 with token, expiresAt, sessionId; 401 for invalid session; 500 for errors
 */

import {APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda'
import {ApiHandlerParams, logDebug, logError, logInfo, response, wrapApiHandler} from '#util/lambda-helpers'
import {refreshSession, validateSessionToken} from '#util/better-auth-helpers'
import {withXRay} from '#lib/vendor/AWS/XRay'

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
export const handler = withXRay(wrapApiHandler(async ({event, context}: ApiHandlerParams<APIGatewayProxyEvent>): Promise<APIGatewayProxyResult> => {
  // Extract and validate Authorization header
  const authHeader = event.headers?.Authorization || event.headers?.authorization
  if (!authHeader) {
    logError('RefreshToken: missing Authorization header')
    return response(context, 401, {error: 'Missing Authorization header'})
  }

  // Extract token from Bearer format
  const tokenMatch = authHeader.match(/^Bearer (.+)$/)
  if (!tokenMatch) {
    logError('RefreshToken: invalid Authorization header format')
    return response(context, 401, {error: 'Invalid Authorization header format'})
  }

  const token = tokenMatch[1]

  // Validate the session token
  logDebug('RefreshToken: validating session token')
  const sessionPayload = await validateSessionToken(token)

  // Refresh the session (extend expiration)
  logDebug('RefreshToken: refreshing session', {sessionId: sessionPayload.sessionId})
  const {expiresAt} = await refreshSession(sessionPayload.sessionId)

  // Return success with updated session info
  const responseData = {
    token, // Same token, just extended expiration
    expiresAt,
    sessionId: sessionPayload.sessionId,
    userId: sessionPayload.userId
  }

  logInfo('RefreshToken: session refreshed successfully', {sessionId: sessionPayload.sessionId, expiresAt})

  return response(context, 200, responseData)
}))
