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
import type {APIGatewayProxyResult, Context} from 'aws-lambda'
import {getAuth} from '#lib/vendor/BetterAuth/config'
import {assertTokenResponse, getSessionExpirationISO} from '#lib/vendor/BetterAuth/helpers'
import {userLoginRequestSchema, userLoginResponseSchema} from '#types/api-schema'
import type {UserLoginRequest} from '#types/api-schema'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'
import {ApiHandler} from '#lib/lambda/handlers'
import {getPayloadFromEvent, validateRequest} from '#lib/lambda/middleware/apiGateway'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {logInfo} from '#lib/system/logging'

/**
 * Handler for user login via Sign in with Apple
 * Uses Better Auth to verify ID token and create session
 */
class LoginUserHandler extends ApiHandler<CustomAPIGatewayRequestAuthorizerEvent> {
  readonly operationName = 'LoginUser'

  protected async handleRequest(event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> {
    this.addAnnotation('provider', 'apple')

    // 1. Validate request body
    const requestBody = getPayloadFromEvent(event) as UserLoginRequest
    validateRequest(requestBody, userLoginRequestSchema)

    // 2. Sign in using Better Auth with ID token from iOS app
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

    logInfo('LoginUser: Better Auth sign-in successful', {userId: result.user?.id, sessionToken: result.token ? 'present' : 'missing'})

    // 3. Return session token (Better Auth format)
    return buildValidatedResponse(context, 200, {
      token: result.token,
      expiresAt: getSessionExpirationISO(result.session),
      sessionId: result.session?.id || '',
      userId: result.user?.id || ''
    }, userLoginResponseSchema)
  }
}

const handlerInstance = new LoginUserHandler()
export const handler = handlerInstance.handler.bind(handlerInstance)
