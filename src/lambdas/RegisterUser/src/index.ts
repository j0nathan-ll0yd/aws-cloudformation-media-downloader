/**
 * RegisterUser Lambda (Better Auth Version)
 *
 * Registers a new user or retrieves existing user via Sign in with Apple.
 * Creates Better Auth session with OAuth account linking.
 *
 * Migration from custom JWT auth to Better Auth:
 * - Creates User entity (same as before)
 * - Creates Account entity (links user to Apple provider)
 * - Creates Session entity (replaces JWT-only approach)
 * - Returns session token with expiration
 */

import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {Users} from '../../../entities/Users'
import {Accounts} from '../../../entities/Accounts'
import {IdentityProviderApple, User, UserRegistration} from '../../../types/main'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {registerUserSchema} from '../../../util/constraints'
import {lambdaErrorResponse, logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {validateAuthCodeForToken, verifyAppleToken} from '../../../util/secretsmanager-helpers'
import {createIdentityProviderAppleFromTokens, createUserFromToken} from '../../../util/transformers'
import {getUsersByAppleDeviceIdentifier} from '../../../util/shared'
import {createUserSession} from '../../../util/better-auth-helpers'
import {withXRay} from '../../../lib/vendor/AWS/XRay'
import {v4 as uuidv4} from 'uuid'

/**
 * Creates a new user record in DynamoDB
 * @param user - The User object you want to create
 * @param identityProviderApple - The identity provider details for Apple
 * @notExported
 */
async function createUser(user: User, identityProviderApple: IdentityProviderApple) {
  logDebug('createUser <=', {user, identityProviderApple})
  const result = await Users.create({
    userId: user.userId,
    email: identityProviderApple.email,
    firstName: user.firstName || '',
    lastName: user.lastName,
    emailVerified: identityProviderApple.emailVerified,
    identityProviders: identityProviderApple
  }).go()
  logDebug('createUser =>', result)
  return result
}

/**
 * Creates or updates Apple OAuth account link for a user.
 * This links the user to their Apple Sign In account in Better Auth.
 *
 * @param userId - The user ID
 * @param appleUserId - The Apple user ID (sub from token)
 * @param identityProviderApple - Apple identity provider details
 * @notExported
 */
async function createOrUpdateAppleAccount(userId: string, appleUserId: string, identityProviderApple: IdentityProviderApple) {
  logDebug('createOrUpdateAppleAccount <=', {userId, appleUserId})

  // Check if account already exists
  const existingAccounts = await Accounts.query
    .byProvider({
      providerId: 'apple',
      providerAccountId: appleUserId
    })
    .go()

  if (existingAccounts.data.length > 0) {
    // Update existing account with new tokens
    const account = existingAccounts.data[0]
    await Accounts.update({accountId: account.accountId})
      .set({
        accessToken: identityProviderApple.accessToken,
        refreshToken: identityProviderApple.refreshToken,
        expiresAt: identityProviderApple.expiresAt,
        tokenType: identityProviderApple.tokenType
      })
      .go()
    logDebug('createOrUpdateAppleAccount: updated existing account')
  } else {
    // Create new account link
    await Accounts.create({
      accountId: uuidv4(),
      userId,
      providerId: 'apple',
      providerAccountId: appleUserId,
      accessToken: identityProviderApple.accessToken,
      refreshToken: identityProviderApple.refreshToken,
      expiresAt: identityProviderApple.expiresAt,
      tokenType: identityProviderApple.tokenType,
      idToken: undefined // Apple doesn't provide separate ID token in our flow
    }).go()
    logDebug('createOrUpdateAppleAccount: created new account link')
  }
}

/**
 * Registers a User, or retrieves existing User via Sign in with Apple.
 * Creates Better Auth session with OAuth account linking.
 *
 * Flow:
 * 1. Validate Apple authorization code and get tokens
 * 2. Verify Apple ID token
 * 3. Check if user exists (by Apple user ID)
 * 4. Create user if new, retrieve if existing
 * 5. Create/update Apple account link
 * 6. Create session
 * 7. Return session token with expiration
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

    // 2. Exchange authorization code for Apple tokens
    const appleToken = await validateAuthCodeForToken(requestBody.authorizationCode)
    const verifiedToken = await verifyAppleToken(appleToken.id_token)
    const appleUserId = verifiedToken.sub

    // 3. Check if user exists
    const users = await getUsersByAppleDeviceIdentifier(appleUserId)
    let userId: string

    if (users.length === 1) {
      // Existing user - use their ID
      userId = users[0].userId
      logInfo('RegisterUser: existing user found', {userId})
    } else {
      // New user - create user record
      const user = createUserFromToken(verifiedToken, requestBody.firstName as string, requestBody.lastName as string)
      const identityProviderApple = createIdentityProviderAppleFromTokens(appleToken, verifiedToken)
      await createUser(user, identityProviderApple)
      userId = user.userId
      logInfo('RegisterUser: new user created', {userId})
    }

    // 4. Create or update Apple OAuth account link
    const identityProviderApple = createIdentityProviderAppleFromTokens(appleToken, verifiedToken)
    await createOrUpdateAppleAccount(userId, appleUserId, identityProviderApple)

    // 5. Create session (extract device info from request if available)
    const deviceId = undefined // deviceId not provided in registration request
    const ipAddress = event.requestContext?.identity?.sourceIp
    const userAgent = event.headers?.['User-Agent']

    const session = await createUserSession(userId, deviceId, ipAddress, userAgent)

    // 6. Return session token with expiration
    logInfo('RegisterUser: session created', {
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
    logInfo('RegisterUser: error', {error})
    return lambdaErrorResponse(context, error)
  }
})
