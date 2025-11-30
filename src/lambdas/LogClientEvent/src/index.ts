import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {logInfo, response} from '../../../util/lambda-helpers'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

export const handler = withXRay(async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const deviceId = event.headers['x-device-uuid']
  const message = event.body
  logInfo('Event received', { deviceId, message })
  return response(context, 204)
})
