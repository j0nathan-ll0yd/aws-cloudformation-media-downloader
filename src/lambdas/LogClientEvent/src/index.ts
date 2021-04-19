import { APIGatewayEvent, APIGatewayProxyResult, Context } from 'aws-lambda'
import { logInfo, response } from '../../../util/lambda-helpers'

export async function handleClientEvent(event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> {
  const deviceId = event.headers['x-device-uuid']
  const message = event.body
  logInfo('Event received', { deviceId, message })
  return response(context, 204)
}
