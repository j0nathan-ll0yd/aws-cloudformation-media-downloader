import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {UserLogin} from '../../../types/main'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {loginUserConstraints} from '../../../util/constraints'
import {getUsersByAppleDeviceIdentifier, lambdaErrorResponse, logInfo, response} from '../../../util/lambda-helpers'
import {createAccessToken, validateAuthCodeForToken, verifyAppleToken} from '../../../util/secretsmanager-helpers'

/**
 * Logs in a User via Sign in with Apple
 * @notExported
 */
export async function handler(event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> {
  logInfo('event <=', event)
  let requestBody
  try {
    requestBody = getPayloadFromEvent(event) as UserLogin
    validateRequest(requestBody, loginUserConstraints)
  } catch (error) {
    return lambdaErrorResponse(context, error)
  }

  const appleToken = await validateAuthCodeForToken(requestBody.authorizationCode)
  const verifiedToken = await verifyAppleToken(appleToken.id_token)
  const appleUserId = verifiedToken.sub
  const users = await getUsersByAppleDeviceIdentifier(appleUserId)
  const count = users.length
  if (count === 0) {
    return response(context, 404, "User doesn't exist")
  } else if (count > 1) {
    return response(context, 300, 'Duplicate user detected')
  }

  const userId = users[0].userId
  const token = await createAccessToken(userId)
  return response(context, 200, {token})
}
