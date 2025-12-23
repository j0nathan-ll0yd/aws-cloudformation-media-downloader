import type {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {buildApiResponse} from '#lib/lambda/responses'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {logInfo} from '#lib/system/logging'

export const handler = withPowertools(async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const deviceId = event.headers['x-device-uuid']
  const message = event.body
  logInfo('Event received', {deviceId, message})
  return buildApiResponse(context, 204)
})
