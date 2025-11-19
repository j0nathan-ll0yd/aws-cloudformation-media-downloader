import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {logInfo, response} from '../../../util/lambda-helpers'
import {withXRay} from '../../../util/lambdaDecorator'

export const handler = withXRay(async (event: APIGatewayEvent, context: Context, {traceId: _traceId}): Promise<APIGatewayProxyResult> => {
  const deviceId = event.headers['x-device-uuid']
  const message = event.body
  logInfo('Event received', {deviceId, message})
  return response(context, 204)
})
