import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {Users} from '../../../lib/vendor/ElectroDB/entities/Users'
import {IdentityProviderApple, User, UserRegistration} from '../../../types/main'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {registerUserSchema} from '../../../util/constraints'
import {lambdaErrorResponse, logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {createAccessToken, validateAuthCodeForToken, verifyAppleToken} from '../../../util/secretsmanager-helpers'
import {createIdentityProviderAppleFromTokens, createUserFromToken} from '../../../util/transformers'
import {getUsersByAppleDeviceIdentifier} from '../../../util/shared'
import {withXRay} from '../../../lib/vendor/AWS/XRay'


/**
 * Creates a new user record in DynamoDB
 * @param user - The User object you want to create
 * @param identityProviderApple - The identity provider details for Apple
 * @notExported
 */
async function createUser(user: User, identityProviderApple: IdentityProviderApple) {
  logDebug('createUser <=', {user, identityProviderApple})
  const response = await Users.create({
    userId: user.userId,
    email: identityProviderApple.email,
    firstName: user.firstName || '',
    lastName: user.lastName,
    emailVerified: identityProviderApple.emailVerified,
    identityProviders: identityProviderApple
  }).go()
  logDebug('createUser =>', response)
  return response
}

/**
 * Registers a User, or retrieves existing User via Sign in with Apple
 * - NOTE: All User details are sourced from the identity token
 * @notExported
 */
export const handler = withXRay(async (event: APIGatewayEvent, context: Context, {traceId: _traceId}): Promise<APIGatewayProxyResult> => {
  logInfo('event <=', event)
  let requestBody
  try {
    requestBody = getPayloadFromEvent(event) as UserRegistration
    validateRequest(requestBody, registerUserSchema)
    const appleToken = await validateAuthCodeForToken(requestBody.authorizationCode)
    const verifiedToken = await verifyAppleToken(appleToken.id_token)
    const appleUserId = verifiedToken.sub
    const users = await getUsersByAppleDeviceIdentifier(appleUserId)
    let token: string
    if (users.length === 1) {
      const userId = users[0].userId
      token = await createAccessToken(userId)
    } else {
      const user = createUserFromToken(verifiedToken, requestBody.firstName as string, requestBody.lastName as string)
      const identityProviderApple = createIdentityProviderAppleFromTokens(appleToken, verifiedToken)
      await createUser(user, identityProviderApple)
      token = await createAccessToken(user.userId)
    }
    return response(context, 200, {token})
  } catch (error) {
    return lambdaErrorResponse(context, error)
  }
})
