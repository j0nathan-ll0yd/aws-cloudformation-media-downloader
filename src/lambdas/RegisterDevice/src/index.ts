import {APIGatewayEvent, Context} from 'aws-lambda'
import {createPlatformEndpoint, subscribe} from '../../../lib/vendor/AWS/SNS'
import {DeviceRegistration} from '../../../types/main'
import {processEventAndValidate} from '../../../util/apigateway-helpers'
import {registerDeviceConstraints} from '../../../util/constraints'
import {logDebug, logInfo, response} from '../../../util/lambda-helpers'

export async function handleDeviceRegistration(event: APIGatewayEvent, context: Context) {
  logInfo('event <=', event)
  const {requestBody, statusCode, message} = processEventAndValidate(event, registerDeviceConstraints)
  if (statusCode && message) {
    return response(context, statusCode, message)
  }
  const body = (requestBody as DeviceRegistration)
  logInfo('process.env.PlatformApplicationArn <=', process.env.PlatformApplicationArn)
  if (process.env.PlatformApplicationArn.length === 0) {
    return response(context, 200, {
      endpointArn: 'requires configuration'
    })
  }

  // TODO: Add the device ID attribute, and figure out how to stop multiple subscriptions
  // const deviceId = event.headers['x-device-uuid']
  const createPlatformEndpointParams = {
    Attributes: {UserId: '1234', ChannelId: '1234'},
    PlatformApplicationArn: process.env.PlatformApplicationArn,
    Token: body.token
  }
  logDebug('createPlatformEndpoint <=', createPlatformEndpointParams)
  const createPlatformEndpointResponse = await createPlatformEndpoint(createPlatformEndpointParams)
  logDebug('createPlatformEndpoint =>', createPlatformEndpointParams)

  const subscribeParams = {
    Endpoint: createPlatformEndpointResponse.EndpointArn,
    Protocol: 'application',
    TopicArn: process.env.PushNotificationTopicArn
  }
  logDebug('subscribe <=', subscribeParams)
  const subscribeResponse = await subscribe(subscribeParams)
  logDebug('subscribe =>', subscribeResponse)

  return response(context, 201, {endpointArn: createPlatformEndpointResponse.EndpointArn})
}
