import type {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {logInfo, response, withPowertools} from '#util/lambda-helpers'

export const handler = withPowertools(async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const deviceId = event.headers['x-device-uuid']
  const message = event.body
  logInfo('Event received', {deviceId, message})
  return response(context, 204)
})
