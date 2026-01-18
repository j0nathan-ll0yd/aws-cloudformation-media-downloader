/**
 * LogoutUser Lambda
 *
 * Invalidates the user's current session by deleting it from the database.
 * This logs the user out and requires them to re-authenticate.
 *
 * Request: POST with Authorization Bearer header, empty body
 * Response: 204 No Content on success; 401 for invalid session; 500 for errors
 */
import type {APIGatewayProxyResult, Context} from 'aws-lambda'
import {deleteSession} from '#entities/queries'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'
import {DatabaseOperation, DatabaseTable} from '#types/databasePermissions'
import {extractBearerToken} from '#lib/lambda/auth-helpers'
import {ApiHandler, RequiresDatabase} from '#lib/lambda/handlers'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {validateSessionToken} from '#lib/domain/auth/sessionService'
import {logDebug, logInfo} from '#lib/system/logging'

/**
 * Handler for logging out users by invalidating their session
 * Validates the current session and then deletes it from the database
 */
@RequiresDatabase([{table: DatabaseTable.Sessions, operations: [DatabaseOperation.Select, DatabaseOperation.Delete]}])
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

    // Delete the session
    logDebug('LogoutUser: deleting session', {sessionId: sessionPayload.sessionId})
    await deleteSession(sessionPayload.sessionId)

    logInfo('LogoutUser: session deleted successfully', {sessionId: sessionPayload.sessionId, userId: sessionPayload.userId})

    // Return 204 No Content
    return buildValidatedResponse(context, 204)
  }
}

const handlerInstance = new LogoutUserHandler()
export const handler = handlerInstance.handler.bind(handlerInstance)
