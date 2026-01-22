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
import type {APIGatewayProxyResult, Context} from 'aws-lambda'
import {updateUser} from '#entities/queries'
import {getAuth} from '#lib/vendor/BetterAuth/config'
import {assertTokenResponse, getSessionExpirationISO} from '#lib/vendor/BetterAuth/helpers'
import {userRegistrationRequestSchema, userRegistrationResponseSchema} from '#types/api-schema'
import type {UserRegistrationRequest} from '#types/api-schema'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'
import {ApiHandler, metrics, MetricUnit} from '#lib/lambda/handlers'
import {getPayloadFromEvent, validateRequest} from '#lib/lambda/middleware/apiGateway'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {logInfo} from '#lib/system/logging'

/**
 * Handler for user registration via Sign in with Apple
 * Uses Better Auth to verify ID token and create/find user
 */
class RegisterUserHandler extends ApiHandler<CustomAPIGatewayRequestAuthorizerEvent> {
  readonly operationName = 'RegisterUser'

  protected async handleRequest(event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> {
    this.addAnnotation('provider', 'apple')

    // 1. Validate request
    const requestBody = getPayloadFromEvent(event) as UserRegistrationRequest
    validateRequest(requestBody, userRegistrationRequestSchema)

    // 2. Sign in/Register using Better Auth with ID token from iOS app
    const ipAddress = event.requestContext?.identity?.sourceIp
    const userAgent = event.headers?.['User-Agent'] || ''

    const auth = await getAuth()
    const rawResult = await auth.api.signInSocial({
      headers: {'user-agent': userAgent, 'x-forwarded-for': ipAddress || ''},
      body: {provider: 'apple', idToken: {token: requestBody.idToken}}
    })

    // Assert token response (throws if redirect)
    const result = assertTokenResponse(rawResult)
    this.addAnnotation('userId', result.user?.id || 'unknown')

    // 3. Check if this is a new user and update with name from iOS app
    const isNewUser = !result.user?.createdAt || Date.now() - new Date(result.user.createdAt).getTime() < 5000
    this.addMetadata('isNewUser', isNewUser)

    if (isNewUser && (requestBody.firstName || requestBody.lastName)) {
      const fullName = [requestBody.firstName, requestBody.lastName].filter(Boolean).join(' ')
      await updateUser(result.user.id, {name: fullName, firstName: requestBody.firstName || '', lastName: requestBody.lastName || ''})

      logInfo('RegisterUser: Updated new user with name from iOS app', {
        userId: result.user.id,
        hasFirstName: !!requestBody.firstName,
        hasLastName: !!requestBody.lastName
      })
    }

    // Track new user registrations separately
    if (isNewUser) {
      metrics.addMetric('NewUserRegistration', MetricUnit.Count, 1)
    }

    logInfo('RegisterUser: Better Auth sign-in/registration successful', {
      userId: result.user?.id,
      sessionToken: result.token ? 'present' : 'missing',
      tokenLength: result.token?.length,
      tokenPrefix: result.token?.substring(0, 8),
      sessionId: result.session?.id?.substring(0, 8),
      isNewUser
    })

    // 4. Return session token (Better Auth format)
    return buildValidatedResponse(context, 200, {
      token: result.token,
      expiresAt: getSessionExpirationISO(result.session),
      sessionId: result.session?.id || '',
      userId: result.user?.id || ''
    }, userRegistrationResponseSchema)
  }
}

const handlerInstance = new RegisterUserHandler()
export const handler = handlerInstance.handler.bind(handlerInstance)
