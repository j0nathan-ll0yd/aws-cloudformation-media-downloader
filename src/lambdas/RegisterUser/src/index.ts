import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {putItem} from '../../../lib/vendor/AWS/DynamoDB'
import {UserRegistration} from '../../../types/main'
import {processEventAndValidate} from '../../../util/apigateway-helpers'
import {registerUserConstraints} from '../../../util/constraints'
import {newUserParams} from '../../../util/dynamodb-helpers'
import {logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {createAccessToken, validateAuthCodeForToken, verifyAppleToken} from '../../../util/secretsmanager-helpers'
import {v4 as uuidv4} from 'uuid'

export async function handleRegisterUser(event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> {
  logInfo('event <=', event)
  const {requestBody, statusCode, message} = processEventAndValidate(event, registerUserConstraints)
  if (statusCode && message) {
    return response(context, statusCode, message)
  }
  const body = requestBody as UserRegistration

  logDebug('validateAuthCodeForToken <=')
  const appleToken = await validateAuthCodeForToken(body.authorizationCode)
  logDebug('validateAuthCodeForToken =>', appleToken)

  logDebug('verifyAppleToken <=')
  const verifiedToken = await verifyAppleToken(appleToken.id_token)
  logDebug('verifyAppleToken =>', verifiedToken)

  const user = {
    userId: uuidv4(),
    email: verifiedToken.email,
    emailVerified: verifiedToken.email_verified,
    firstName: body.firstName,
    lastName: body.lastName
  }

  const identityProviderApple = {
    accessToken: appleToken.access_token,
    refreshToken: appleToken.refresh_token,
    tokenType: appleToken.token_type,
    expiresAt: new Date(Date.now() + appleToken.expires_in).getTime(),
    userId: verifiedToken.sub,
    email: verifiedToken.email,
    emailVerified: verifiedToken.email_verified,
    isPrivateEmail: verifiedToken.is_private_email
  }
  const putItemParams = newUserParams(process.env.DynamoDBTable, user, identityProviderApple)
  logDebug('putItem <=', putItemParams)
  const putItemResponse = await putItem(putItemParams)
  logDebug('putItem =>', putItemResponse)
  const token = await createAccessToken(user.userId)
  return response(context, 200, {token})
}
