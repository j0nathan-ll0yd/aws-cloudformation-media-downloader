import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {putItem} from '../../../lib/vendor/AWS/DynamoDB'
import {IdentityProviderApple, User, UserRegistration} from '../../../types/main'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {registerUserSchema} from '../../../util/constraints'
import {newUserParams} from '../../../util/dynamodb-helpers'
import {lambdaErrorResponse, logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {createAccessToken, validateAuthCodeForToken, verifyAppleToken} from '../../../util/secretsmanager-helpers'
import {createIdentityProviderAppleFromTokens, createUserFromToken} from '../../../util/transformers'
import {getUsersByAppleDeviceIdentifier} from '../../../util/shared'

/**
 * Creates a new user record in DynamoDB
 * @param user - The User object you want to create
 * @param identityProviderApple - The identity provider details for Apple
 * @notExported
 */
async function createUser(user: User, identityProviderApple: IdentityProviderApple) {
  const putItemParams = newUserParams(process.env.DynamoDBTableUsers as string, user, identityProviderApple)
  logDebug('putItem <=', putItemParams)
  const putItemResponse = await putItem(putItemParams)
  logDebug('putItem =>', putItemResponse)
  return putItemResponse
}

/**
 * Registers a User, or retrieves existing User via Sign in with Apple
 * - NOTE: All User details are sourced from the identity token
 * @notExported
 */
export async function handler(event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> {
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
}
