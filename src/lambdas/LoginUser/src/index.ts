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

import {getAuth} from '#lib/vendor/BetterAuth/config'
import {assertTokenResponse, getSessionExpirationISO} from '#lib/vendor/BetterAuth/helpers'
import {addAnnotation, addMetadata, endSpan, startSpan} from '#lib/vendor/OpenTelemetry'
import {userLoginRequestSchema, userLoginResponseSchema} from '#types/api-schema'
import type {UserLoginRequest} from '#types/api-schema'
import {getPayloadFromEvent, validateRequest} from '#lib/lambda/middleware/apiGateway'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {metrics, MetricUnit, withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapApiHandler} from '#lib/lambda/middleware/api'
import {logInfo} from '#lib/system/logging'

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
  // Track login attempt
  metrics.addMetric('LoginAttempt', MetricUnit.Count, 1)

  const span = startSpan('login-user-auth')
  addAnnotation(span, 'provider', 'apple')

  try {
    // 1. Validate request body
    const requestBody = getPayloadFromEvent(event) as UserLoginRequest
    validateRequest(requestBody, userLoginRequestSchema)

    // 2. Sign in using Better Auth with ID token from iOS app
    // Better Auth handles:
    // - ID token verification (signature, expiration, issuer using Apple's public JWKS)
    // - User lookup by Apple ID
    // - Session creation with device tracking
    // - Account linking if needed
    const ipAddress = event.requestContext?.identity?.sourceIp
    const userAgent = event.headers?.['User-Agent'] || ''

    const auth = await getAuth()
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

    // Assert token response (throws if redirect)
    const result = assertTokenResponse(rawResult)

    // Track successful login
    metrics.addMetric('LoginSuccess', MetricUnit.Count, 1)
    addAnnotation(span, 'userId', result.user?.id || 'unknown')
    addMetadata(span, 'success', true)
    endSpan(span)

    logInfo('LoginUser: Better Auth sign-in successful', {userId: result.user?.id, sessionToken: result.token ? 'present' : 'missing'})

    // 3. Return session token (Better Auth format)
    return buildValidatedResponse(context, 200, {
      token: result.token,
      expiresAt: getSessionExpirationISO(result.session),
      sessionId: result.session?.id || '',
      userId: result.user?.id || ''
    }, userLoginResponseSchema)
  } catch (error) {
    endSpan(span, error as Error)
    throw error
  }
}))
