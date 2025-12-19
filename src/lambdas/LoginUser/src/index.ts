/**
 * LoginUser Lambda (Better Auth Version)
 *
 * Logs in an existing user via Sign in with Apple using Better Auth OAuth.
 * Fully delegates OAuth verification and session creation to Better Auth.
 *
 * Flow:
 * 1. Receive ID token directly from iOS app (Apple SDK provides this)
 * 2. Use Better Auth to verify and sign in with ID token
 * 3. Better Auth handles user lookup, session creation, and account linking
 */

import type {UserLoginInput} from '#types/request-types'
import {getPayloadFromEvent, validateRequest} from '#util/apigateway-helpers'
import {loginUserSchema} from '#util/constraints'
import {logInfo, response, withPowertools, wrapApiHandler} from '#util/lambda-helpers'
import {auth} from '#lib/vendor/BetterAuth/config'

/**
 * Logs in a User via Sign in with Apple using Better Auth.
 *
 * Flow:
 * 1. Receive ID token directly from iOS app
 * 2. Use Better Auth's OAuth sign-in with ID token
 * 3. Better Auth verifies token, finds user, creates session
 * 4. Return session token with expiration
 *
 * Error cases:
 * - 401: Invalid ID token
 * - 404: User not found (need to register first)
 * - 500: Other errors
 *
 * @notExported
 */
export const handler = withPowertools(wrapApiHandler(async ({event, context}) => {
  // 1. Validate request body
  const requestBody = getPayloadFromEvent(event) as UserLoginInput
  validateRequest(requestBody, loginUserSchema)

  // 2. Sign in using Better Auth with ID token from iOS app
  // Better Auth handles:
  // - ID token verification (signature, expiration, issuer using Apple's public JWKS)
  // - User lookup by Apple ID
  // - Session creation with device tracking
  // - Account linking if needed
  const ipAddress = event.requestContext?.identity?.sourceIp
  const userAgent = event.headers?.['User-Agent'] || ''

  const rawResult = await auth.api.signInSocial({
    headers: {'user-agent': userAgent, 'x-forwarded-for': ipAddress || ''},
    body: {
      provider: 'apple',
      idToken: {
        token: requestBody.idToken
        // No accessToken needed - we only have the ID token from iOS
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

  logInfo('LoginUser: Better Auth sign-in successful', {userId: result.user?.id, sessionToken: result.token ? 'present' : 'missing'})

  // 3. Return session token (Better Auth format)
  return response(context, 200, {
    token: result.token,
    expiresAt: result.session?.expiresAt || Date.now() + 30 * 24 * 60 * 60 * 1000,
    sessionId: result.session?.id,
    userId: result.user?.id
  })
}))
