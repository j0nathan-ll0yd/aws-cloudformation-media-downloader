import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {scan} from '../../../lib/vendor/AWS/DynamoDB'
import {UserLogin} from '../../../types/main'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {loginUserConstraints} from '../../../util/constraints'
import {getUserByAppleDeviceIdentifierParams} from '../../../util/dynamodb-helpers'
import {lambdaErrorResponse, logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {createAccessToken, validateAuthCodeForToken, verifyAppleToken} from '../../../util/secretsmanager-helpers'

/**
 * Searches for a User record via their Apple Device ID
 * @param userDeviceId - The subject registered claim that identifies the principal user.
 * @notExported
 */
async function getUserByAppleDeviceIdentifier(userDeviceId: string) {
  const scanParams = getUserByAppleDeviceIdentifierParams(process.env.DynamoDBTableUsers, userDeviceId)
  logDebug('scan <=', scanParams)
  const scanResponse = await scan(scanParams)
  logDebug('scan =>', scanResponse)
  return scanResponse
}

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
  const userDeviceId = verifiedToken.sub
  const userDetails = await getUserByAppleDeviceIdentifier(userDeviceId)
  if (userDetails.Count === 0) {
    return response(context, 404, "User doesn't exist")
  } else if (userDetails.Count > 1) {
    return response(context, 300, 'Duplicate user detected')
  }

  const userId = userDetails.Items[0].userId
  const token = await createAccessToken(userId)
  return response(context, 200, {token})
}
