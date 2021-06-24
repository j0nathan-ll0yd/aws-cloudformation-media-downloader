import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {scan} from '../../../lib/vendor/AWS/DynamoDB'
import {UserLogin} from '../../../types/main'
import {processEventAndValidate} from '../../../util/apigateway-helpers'
import {loginUserConstraints} from '../../../util/constraints'
import {getUserByAppleDeviceIdentifier} from '../../../util/dynamodb-helpers'
import {logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {createAccessToken, validateAuthCodeForToken, verifyAppleToken} from '../../../util/secretsmanager-helpers'

export async function handler(event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> {
  logInfo('event <=', event)
  const {requestBody, statusCode, message} = processEventAndValidate(event, loginUserConstraints)
  if (statusCode && message) {
    return response(context, statusCode, message)
  }
  const body = requestBody as UserLogin

  logDebug('validateAuthCodeForToken <=')
  const appleToken = await validateAuthCodeForToken(body.authorizationCode)
  logDebug('validateAuthCodeForToken =>', appleToken)

  logDebug('verifyAppleToken <=')
  const verifiedToken = await verifyAppleToken(appleToken.id_token)
  logDebug('verifyAppleToken =>', verifiedToken)

  const userDeviceId = verifiedToken.sub
  const scanParams = getUserByAppleDeviceIdentifier(process.env.DynamoDBTableUsers, userDeviceId)
  logDebug('scan <=', scanParams)
  const scanResponse = await scan(scanParams)
  logDebug('scan =>', scanResponse)
  if (scanResponse.Count === 0) {
    return response(context, 404, "User doesn't exist")
  } else if (scanResponse.Count > 1) {
    return response(context, 300, 'Duplicate user detected')
  }

  const userId = scanResponse.Items[0].userId
  const token = await createAccessToken(userId)
  return response(context, 200, {token})
}
