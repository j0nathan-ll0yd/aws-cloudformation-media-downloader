/**
 * RegisterUser Lambda (Better Auth Version)
 *
 * Registers a new user or logs in existing user via Sign in with Apple using Better Auth OAuth.
 * Fully delegates OAuth verification, user creation, and session creation to Better Auth.
 *
 * Migration path:
 * - Phase 1: Custom OAuth validation + manual user/session creation
 * - Phase 2: OAuth code exchange + Better Auth sign-in (current)
 * - Phase 3: iOS app sends ID token directly (future)
 *
 * Current flow:
 * 1. Exchange authorization code for Apple ID token
 * 2. Use Better Auth to verify and sign in/register with ID token
 * 3. Better Auth handles user creation, OAuth account linking, and session creation
 */

import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {UserRegistration} from '../../../types/main'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {registerUserSchema} from '../../../util/constraints'
import {lambdaErrorResponse, logInfo, response} from '../../../util/lambda-helpers'
import {validateAuthCodeForToken} from '../../../util/secretsmanager-helpers'
import {auth} from '../../../lib/vendor/BetterAuth/config'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

/**
 * Registers a User or logs in existing User via Sign in with Apple using Better Auth.
 *
 * Flow:
 * 1. Exchange authorization code for Apple ID token
 * 2. Use Better Auth's OAuth sign-in/registration with ID token
 * 3. Better Auth verifies token, creates/finds user, links account, creates session
 * 4. Return session token with expiration
 *
 * Note: firstName and lastName from request body are currently not used during
 * registration because Better Auth extracts name from Apple's ID token. If custom
 * name handling is needed, we'd need to update the user record after Better Auth
 * creates it.
 *
 * Error cases:
 * - 401: Invalid authorization code or ID token
 * - 500: Other errors
 *
 * @notExported
 */
export const handler = withXRay(async (event: APIGatewayEvent, context: Context, {traceId: _traceId}): Promise<APIGatewayProxyResult> => {
  logInfo('RegisterUser (Better Auth): event <=', event)
  let requestBody: UserRegistration

  try {
    // 1. Validate request and Apple authorization code
    requestBody = getPayloadFromEvent(event) as UserRegistration
    validateRequest(requestBody, registerUserSchema)

    // 2. Exchange authorization code for Apple tokens (iOS app limitation)
    // TODO: Update iOS app to send ID token directly, eliminating this step
    const appleToken = await validateAuthCodeForToken(requestBody.authorizationCode)
    logInfo('RegisterUser: obtained Apple tokens')

    // 3. Sign in/Register using Better Auth with ID token
    // Better Auth handles:
    // - ID token verification (signature, expiration, issuer)
    // - User lookup by Apple ID (or creation if new)
    // - OAuth account linking (Accounts entity)
    // - Session creation with device tracking
    // - Email verification status from Apple
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

    logInfo('RegisterUser: Better Auth sign-in/registration successful', {
      userId: result.user?.id,
      sessionToken: result.token ? 'present' : 'missing',
      isNewUser: !result.user?.createdAt || Date.now() - new Date(result.user.createdAt).getTime() < 5000
    })

    // 4. Return session token (Better Auth format)
    return response(context, 200, {
      token: result.token,
      expiresAt: result.session?.expiresAt || Date.now() + 30 * 24 * 60 * 60 * 1000,
      sessionId: result.session?.id,
      userId: result.user?.id
    })
  } catch (error) {
    logInfo('RegisterUser: error', {error})
    return lambdaErrorResponse(context, error)
  }
})
