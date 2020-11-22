import {APIGatewayEvent, Context} from 'aws-lambda'
import {logInfo, response} from '../../../util/lambda-helpers'
import {createAccessToken} from '../../../util/secretsmanager-helpers'
import { v4 as uuidv4 } from 'uuid'

export async function handleLoginUser(event: APIGatewayEvent, context: Context) {
  logInfo('event <=', event)
  const token = await createAccessToken(uuidv4())
  return response(context, 200, {token})
}
