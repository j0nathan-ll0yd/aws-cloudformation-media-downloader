/**
 * RegisterUser Lambda (Better Auth Version)
 *
 * Registers a new user or logs in existing user via Sign in with Apple using Better Auth OAuth.
 * Fully delegates OAuth verification, user creation, and session creation to Better Auth.
 *
 * Flow:
 * 1. Receive ID token directly from iOS app (Apple SDK provides this)
 * 2. Use Better Auth to verify and sign in/register with ID token
 * 3. Better Auth handles user creation, OAuth account linking, and session creation
 * 4. Update user with first/last name from iOS app (Apple doesn't include name in ID token)
 *
 * Note: Apple's ID token doesn't contain first/last name for privacy reasons.
 * The iOS app sends this separately from ASAuthorizationAppleIDCredential.fullName.
 * This is only populated on first sign-in, so we cache it for new user registration.
 */

import type {APIGatewayEvent, APIGatewayProxyResult} from 'aws-lambda'
import {updateUser} from '#entities/queries'
import {getAuth} from '#lib/vendor/BetterAuth/config'
import {assertTokenResponse, getSessionExpirationISO} from '#lib/vendor/BetterAuth/helpers'
import {userRegistrationRequestSchema, userRegistrationResponseSchema} from '#types/api-schema'
import type {UserRegistrationRequest} from '#types/api-schema'
import type {ApiHandlerParams} from '#types/lambda'
import {getPayloadFromEvent, validateRequest} from '#lib/lambda/middleware/apiGateway'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {metrics, MetricUnit, withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapApiHandler} from '#lib/lambda/middleware/api'
import {logInfo} from '#lib/system/logging'

/**
 * Registers a User or logs in existing User via Sign in with Apple using Better Auth.
 *
 * Flow:
 * 1. Receive ID token directly from iOS app
 * 2. Use Better Auth's OAuth sign-in/registration with ID token
 * 3. Better Auth verifies token, creates/finds user, links account, creates session
 * 4. Update user with first/last name if this is a new registration
 * 5. Return session token with expiration
 *
 * Error cases:
 * - 401: Invalid ID token
 * - 500: Other errors
 *
 * @notExported
 */
export const handler = withPowertools(wrapApiHandler(async ({event, context}: ApiHandlerParams<APIGatewayEvent>): Promise<APIGatewayProxyResult> => {
  // Track registration attempt
  metrics.addMetric('RegistrationAttempt', MetricUnit.Count, 1)

  // 1. Validate request
  const requestBody = getPayloadFromEvent(event) as UserRegistrationRequest
  validateRequest(requestBody, userRegistrationRequestSchema)

  // 2. Sign in/Register using Better Auth with ID token from iOS app
  // Better Auth handles:
  // - ID token verification (signature, expiration, issuer using Apple's public JWKS)
  // - User lookup by Apple ID (or creation if new)
  // - OAuth account linking (Accounts entity)
  // - Session creation with device tracking
  // - Email verification status from Apple
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

  // 3. Check if this is a new user and update with name from iOS app
  // Apple's ID token doesn't include first/last name for privacy reasons
  // The iOS app provides this from ASAuthorizationAppleIDCredential.fullName
  // (only populated on first sign-in)
  const isNewUser = !result.user?.createdAt || Date.now() - new Date(result.user.createdAt).getTime() < 5000

  if (isNewUser && (requestBody.firstName || requestBody.lastName)) {
    const fullName = [requestBody.firstName, requestBody.lastName].filter(Boolean).join(' ')
    await updateUser(result.user.id, {name: fullName, firstName: requestBody.firstName || '', lastName: requestBody.lastName || ''})

    logInfo('RegisterUser: Updated new user with name from iOS app', {
      userId: result.user.id,
      hasFirstName: !!requestBody.firstName,
      hasLastName: !!requestBody.lastName
    })
  }

  // Track successful registration
  metrics.addMetric('RegistrationSuccess', MetricUnit.Count, 1)
  if (isNewUser) {
    metrics.addMetric('NewUserRegistration', MetricUnit.Count, 1)
  }

  logInfo('RegisterUser: Better Auth sign-in/registration successful', {
    userId: result.user?.id,
    sessionToken: result.token ? 'present' : 'missing',
    isNewUser
  })

  // 4. Return session token (Better Auth format)
  return buildValidatedResponse(context, 200, {
    token: result.token,
    expiresAt: getSessionExpirationISO(result.session),
    sessionId: result.session?.id || '',
    userId: result.user?.id || ''
  }, userRegistrationResponseSchema)
}))
