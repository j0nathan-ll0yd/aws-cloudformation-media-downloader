import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {CustomAPIGatewayRequestAuthorizerEvent, UserLogin} from '../../../types/main'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {loginUserSchema} from '../../../util/constraints'
import {lambdaErrorResponse, logIncomingFixture, logOutgoingFixture, response} from '../../../util/lambda-helpers'
import {createAccessToken, validateAuthCodeForToken, verifyAppleToken} from '../../../util/secretsmanager-helpers'
import {getUsersByAppleDeviceIdentifier} from '../../../util/shared'

/**
 * Logs in a User via Sign in with Apple
 * @notExported
 */
export async function handler(event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> {
  logIncomingFixture(event)
  let requestBody
  try {
    requestBody = getPayloadFromEvent(event) as UserLogin
    validateRequest(requestBody, loginUserSchema)
  } catch (error) {
    const errorResponse = lambdaErrorResponse(context, error)
    logOutgoingFixture(errorResponse)
    return errorResponse
  }

  const appleToken = await validateAuthCodeForToken(requestBody.authorizationCode)
  const verifiedToken = await verifyAppleToken(appleToken.id_token)
  const appleUserId = verifiedToken.sub
  const users = await getUsersByAppleDeviceIdentifier(appleUserId)
  const count = users.length
  if (count === 0) {
    const notFoundResponse = response(context, 404, "User doesn't exist")
    logOutgoingFixture(notFoundResponse)
    return notFoundResponse
  } else if (count > 1) {
    const duplicateResponse = response(context, 300, 'Duplicate user detected')
    logOutgoingFixture(duplicateResponse)
    return duplicateResponse
  }

  const userId = users[0].userId
  const token = await createAccessToken(userId)
  const successResponse = response(context, 200, {token})
  logOutgoingFixture(successResponse)
  return successResponse
}
