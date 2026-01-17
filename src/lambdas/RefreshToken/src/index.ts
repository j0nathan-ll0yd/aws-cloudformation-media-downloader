/**
 * RefreshToken Lambda
 *
 * Refreshes a user session by extending the expiration time.
 * This allows users to stay logged in without re-authenticating.
 *
 * Request: POST with Authorization Bearer header, empty body
 * Response: 200 with token, expiresAt, sessionId; 401 for invalid session; 500 for errors
 */
import type {APIGatewayProxyResult, Context} from 'aws-lambda'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'
import {userLoginResponseSchema} from '#types/api-schema'
import {DatabaseOperation, DatabaseTable} from '#types/databasePermissions'
import {ApiHandler, RequiresDatabase} from '#lib/lambda/handlers'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {logDebug, logInfo} from '#lib/system/logging'
import {refreshSession, validateSessionToken} from '#lib/domain/auth/sessionService'
import {extractBearerToken} from '#lib/lambda/auth-helpers'

/**
 * Handler for refreshing session tokens
 * Validates the current session and extends its expiration
 */
@RequiresDatabase({tables: [{table: DatabaseTable.Sessions, operations: [DatabaseOperation.Select, DatabaseOperation.Update]}]})
class RefreshTokenHandler extends ApiHandler<CustomAPIGatewayRequestAuthorizerEvent> {
  readonly operationName = 'RefreshToken'

  protected async handleRequest(event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> {
    // Extract Bearer token from Authorization header
    const token = extractBearerToken(event.headers || {})

    // Validate the session token
    logDebug('RefreshToken: validating session token')
    const sessionPayload = await validateSessionToken(token)
    this.addAnnotation('userId', sessionPayload.userId)
    this.addAnnotation('sessionId', sessionPayload.sessionId)

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
  }
}

const handlerInstance = new RefreshTokenHandler()
export const handler = handlerInstance.handler.bind(handlerInstance)
