/**
 * LoginUser Lambda (Better Auth Version)
 *
 * Logs in an existing user via Sign in with Apple.
 * Creates Better Auth session for authenticated user.
 *
 * Migration from custom JWT auth to Better Auth:
 * - Validates Apple authorization code (same as before)
 * - Finds existing user (same as before)
 * - Creates Session entity (replaces JWT-only approach)
 * - Returns session token with expiration
 */

import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {CustomAPIGatewayRequestAuthorizerEvent, UserLogin} from '../../../types/main'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {loginUserSchema} from '../../../util/constraints'
import {lambdaErrorResponse, logInfo, response} from '../../../util/lambda-helpers'
import {validateAuthCodeForToken, verifyAppleToken} from '../../../util/secretsmanager-helpers'
import {getUsersByAppleDeviceIdentifier} from '../../../util/shared'
import {createUserSession} from '../../../util/better-auth-helpers'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

/**
 * Logs in a User via Sign in with Apple.
 * Creates Better Auth session for the authenticated user.
 *
 * Flow:
 * 1. Validate Apple authorization code and get tokens
 * 2. Verify Apple ID token
 * 3. Find user by Apple user ID
 * 4. Create session with device tracking
 * 5. Return session token with expiration
 *
 * Error cases:
 * - 404: User not found (need to register first)
 * - 300: Multiple users found (data integrity issue)
 * - 500: Other errors
 *
 * @notExported
 */
export const handler = withXRay(
  async (
    event: CustomAPIGatewayRequestAuthorizerEvent,
    context: Context,
    {traceId: _traceId}
  ): Promise<APIGatewayProxyResult> => {
    logInfo('LoginUser (Better Auth): event <=', event)
    let requestBody: UserLogin

    try {
      // 1. Validate request body
      requestBody = getPayloadFromEvent(event) as UserLogin
      validateRequest(requestBody, loginUserSchema)

      // 2. Exchange authorization code for Apple tokens
      const appleToken = await validateAuthCodeForToken(requestBody.authorizationCode)
      const verifiedToken = await verifyAppleToken(appleToken.id_token)
      const appleUserId = verifiedToken.sub

      // 3. Find user by Apple user ID
      const users = await getUsersByAppleDeviceIdentifier(appleUserId)
      const count = users.length

      if (count === 0) {
        // User doesn't exist - they need to register first
        logInfo('LoginUser: user not found', {appleUserId})
        return response(context, 404, "User doesn't exist")
      } else if (count > 1) {
        // Multiple users found - data integrity issue
        logInfo('LoginUser: duplicate users found', {appleUserId, count})
        return response(context, 300, 'Duplicate user detected')
      }

      // 4. Create session with device tracking
      const userId = users[0].userId
      const deviceId = requestBody.deviceId
      const ipAddress = event.requestContext?.identity?.sourceIp
      const userAgent = event.headers?.['User-Agent']

      const session = await createUserSession(userId, deviceId, ipAddress, userAgent)

      // 5. Return session token with expiration
      logInfo('LoginUser: session created', {
        userId,
        sessionId: session.sessionId,
        expiresAt: session.expiresAt
      })

      return response(context, 200, {
        token: session.token,
        expiresAt: session.expiresAt,
        sessionId: session.sessionId,
        userId
      })
    } catch (error) {
      logInfo('LoginUser: error', {error})
      return lambdaErrorResponse(context, error)
    }
  }
)
