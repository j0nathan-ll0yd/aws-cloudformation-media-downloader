/**
 * LoginUser Lambda (Better Auth Version)
 *
 * Logs in an existing user via Sign in with Apple using Better Auth OAuth.
 * Fully delegates OAuth verification and session creation to Better Auth.
 *
 * Migration path:
 * - Phase 1: Custom OAuth validation + manual session creation
 * - Phase 2: OAuth code exchange + Better Auth sign-in (current)
 * - Phase 3: iOS app sends ID token directly (future)
 *
 * Current flow:
 * 1. Exchange authorization code for Apple ID token
 * 2. Use Better Auth to verify and sign in with ID token
 * 3. Better Auth handles user lookup, session creation, and account linking
 */

import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {CustomAPIGatewayRequestAuthorizerEvent, UserLogin} from '../../../types/main'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {loginUserSchema} from '../../../util/constraints'
import {lambdaErrorResponse, logInfo, response} from '../../../util/lambda-helpers'
import {validateAuthCodeForToken} from '../../../util/secretsmanager-helpers'
import {auth} from '../../../lib/vendor/BetterAuth/config'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

/**
 * Logs in a User via Sign in with Apple using Better Auth.
 *
 * Flow:
 * 1. Exchange authorization code for Apple ID token
 * 2. Use Better Auth's OAuth sign-in with ID token
 * 3. Better Auth verifies token, finds user, creates session
 * 4. Return session token with expiration
 *
 * Error cases:
 * - 401: Invalid authorization code or ID token
 * - 404: User not found (need to register first)
 * - 500: Other errors
 *
 * @notExported
 */
export const handler = withXRay(async (event: CustomAPIGatewayRequestAuthorizerEvent, context: Context, {traceId: _traceId}): Promise<APIGatewayProxyResult> => {
  logInfo('LoginUser (Better Auth): event <=', event)
  let requestBody: UserLogin

  try {
    // 1. Validate request body
    requestBody = getPayloadFromEvent(event) as UserLogin
    validateRequest(requestBody, loginUserSchema)

    // 2. Exchange authorization code for Apple tokens (iOS app limitation)
    // TODO: Update iOS app to send ID token directly, eliminating this step
    const appleToken = await validateAuthCodeForToken(requestBody.authorizationCode)
    logInfo('LoginUser: obtained Apple tokens')

    // 3. Sign in using Better Auth with ID token
    // Better Auth handles:
    // - ID token verification (signature, expiration, issuer)
    // - User lookup by Apple ID
    // - Session creation with device tracking
    // - Account linking if needed
    const ipAddress = event.requestContext?.identity?.sourceIp
    const userAgent = event.headers?.['User-Agent'] || ''

    const rawResult = await auth.api.signInSocial({
      headers: {
        'user-agent': userAgent,
        'x-forwarded-for': ipAddress || ''
      },
      body: {
        provider: 'apple',
        idToken: {
          token: appleToken.id_token,
          accessToken: appleToken.access_token
        }
      }
    })

    // Better Auth returns a redirect response for OAuth flows or a token response for ID token flows
    // Since we're using ID token authentication, we expect a token response
    if ('url' in rawResult && rawResult.url) {
      throw new Error('Unexpected redirect response from Better Auth - ID token flow should not redirect')
    }

    // Type narrow to token response
    const result = rawResult as {
      redirect: boolean
      token: string
      url: undefined
      user: {id: string; createdAt: Date; email: string; name: string}
      session?: {id: string; expiresAt: number}
    }

    logInfo('LoginUser: Better Auth sign-in successful', {
      userId: result.user?.id,
      sessionToken: result.token ? 'present' : 'missing'
    })

    // 4. Return session token (Better Auth format)
    return response(context, 200, {
      token: result.token,
      expiresAt: result.session?.expiresAt || Date.now() + 30 * 24 * 60 * 60 * 1000,
      sessionId: result.session?.id,
      userId: result.user?.id
    })
  } catch (error) {
    logInfo('LoginUser: error', {error})
    return lambdaErrorResponse(context, error)
  }
})
