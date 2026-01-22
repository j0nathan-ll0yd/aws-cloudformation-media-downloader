/**
 * LogoutUser Lambda
 *
 * Invalidates the user's current session by setting its expiration to the past.
 * This logs the user out and requires them to re-authenticate.
 * Invalidated sessions are retained for audit purposes and purged later by CleanupExpiredRecords.
 *
 * Request: POST with Authorization Bearer header, empty body
 * Response: 204 No Content on success; 401 for invalid session; 500 for errors
 */
import type {APIGatewayProxyResult, Context} from 'aws-lambda'
import {updateSession} from '#entities/queries'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'
import {extractBearerToken} from '#lib/lambda/auth-helpers'
import {ApiHandler} from '#lib/lambda/handlers'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {validateSessionToken} from '#lib/domain/auth/sessionService'
import {logDebug, logInfo} from '#lib/system/logging'

/**
 * Handler for logging out users by invalidating their session
 * Validates the current session and then sets expiresAt to the past
 */
class LogoutUserHandler extends ApiHandler<CustomAPIGatewayRequestAuthorizerEvent> {
  readonly operationName = 'LogoutUser'

  protected async handleRequest(event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> {
    // Extract Bearer token from Authorization header
    const token = extractBearerToken(event.headers || {})

    // Validate the session token
    logDebug('LogoutUser: validating session token')
    const sessionPayload = await validateSessionToken(token)
    this.addAnnotation('userId', sessionPayload.userId)
    this.addAnnotation('sessionId', sessionPayload.sessionId)

    // Invalidate the session by setting expiresAt to the past
    logDebug('LogoutUser: invalidating session', {sessionId: sessionPayload.sessionId})
    await updateSession(sessionPayload.sessionId, {expiresAt: new Date()})

    logInfo('LogoutUser: session invalidated successfully', {sessionId: sessionPayload.sessionId, userId: sessionPayload.userId})

    // Return 204 No Content
    return buildValidatedResponse(context, 204)
  }
}

const handlerInstance = new LogoutUserHandler()
export const handler = handlerInstance.handler.bind(handlerInstance)
