/**
 * RegisterUser Lambda (Better Auth Version)
 *
 * Registers a new user or logs in existing user via Sign in with Apple using Better Auth OAuth.
 * Fully delegates OAuth verification, user creation, and session creation to Better Auth.
 *
 * Trigger: API Gateway POST /user/register
 * Input: UserRegistrationRequest with idToken and optional name fields
 * Output: APIGatewayProxyResult with session token
 *
 * @see {@link ../../../services/auth/registrationService.ts} for auth sign-in logic
 */
import {buildValidatedResponse, defineLambda} from '@mantleframework/core'
import {logInfo, metrics, MetricUnit} from '@mantleframework/observability'
import {defineApiHandler, z} from '@mantleframework/validation'
import {updateUser} from '#entities/queries'
import {signInWithApple} from '#services/auth/registrationService'
import {userRegistrationResponseSchema} from '#types/api-schema'

defineLambda({
  secrets: {AUTH_SECRET: 'platform.key', APPLE_CLIENT_ID: 'signInWithApple.config', APPLE_CLIENT_SECRET: 'signInWithApple.authKey'},
  staticEnvVars: {APPLE_APP_BUNDLE_IDENTIFIER: 'lifegames.OfflineMediaDownloader'}
})

const RegistrationRequestSchema = z.object({idToken: z.string(), firstName: z.string().optional(), lastName: z.string().optional()})

const api = defineApiHandler({auth: 'none', schema: RegistrationRequestSchema, operationName: 'RegisterUser'})
export const handler = api(async ({event, context, body}) => {
  const ipAddress = event.requestContext?.identity?.sourceIp
  const userAgent = event.headers?.['user-agent'] || ''

  const result = await signInWithApple(body.idToken, ipAddress, userAgent)

  if (result.isNewUser && (body.firstName || body.lastName)) {
    const fullName = [body.firstName, body.lastName].filter(Boolean).join(' ')
    await updateUser(result.userId, {name: fullName, firstName: body.firstName || '', lastName: body.lastName || ''})
    logInfo('RegisterUser: Updated new user with name from iOS app', {userId: result.userId, hasFirstName: !!body.firstName, hasLastName: !!body.lastName})
  }

  if (result.isNewUser) {
    metrics.addMetric('NewUserRegistration', MetricUnit.Count, 1)
  }

  logInfo('RegisterUser: Better Auth sign-in/registration successful', {
    userId: result.userId,
    sessionToken: 'present',
    sessionId: result.sessionId.substring(0, 8),
    expiresAt: result.expiresAt,
    isNewUser: result.isNewUser
  })

  return buildValidatedResponse(context, 200, {
    token: result.token,
    expiresAt: new Date(result.expiresAt).toISOString(),
    sessionId: result.sessionId,
    userId: result.userId
  }, userRegistrationResponseSchema)
})
