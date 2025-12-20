import type {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {buildApiResponse, withPowertools} from '#util/lambda-helpers'
import {logInfo} from '#util/logging'

export const handler = withPowertools(async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const deviceId = event.headers['x-device-uuid']
  const message = event.body
  logInfo('Event received', {deviceId, message})
  return buildApiResponse(context, 204)
})
