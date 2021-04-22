import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {updateItem, query} from '../../../lib/vendor/AWS/DynamoDB'
import {createPlatformEndpoint, listSubscriptionsByTopic, subscribe, unsubscribe} from '../../../lib/vendor/AWS/SNS'
import {DeviceRegistration, UserDevice} from '../../../types/main'
import {processEventAndValidate} from '../../../util/apigateway-helpers'
import {registerDeviceConstraints} from '../../../util/constraints'
import {queryUserDeviceParams, updateUserDeviceParams} from '../../../util/dynamodb-helpers'
import {getUserIdFromEvent, logDebug, logError, logInfo, response} from '../../../util/lambda-helpers'

export async function handleDeviceRegistration(event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> {
  logInfo('event <=', event)
  const {requestBody, statusCode, message} = processEventAndValidate(event, registerDeviceConstraints)
  if (statusCode && message) {
    return response(context, statusCode, message)
  }
  const body = requestBody as DeviceRegistration
  logInfo('process.env.PlatformApplicationArn <=', process.env.PlatformApplicationArn)
  if (process.env.PlatformApplicationArn.length === 0) {
    return response(context, 200, {
      endpointArn: 'requires configuration'
    })
  }

  // An idempotent option that creates an endpoint for a device on one of the supported services (e.g. GCP, APNS)
  const createPlatformEndpointParams = {
    PlatformApplicationArn: process.env.PlatformApplicationArn,
    Token: body.token
  }
  logDebug('createPlatformEndpoint <=', createPlatformEndpointParams)
  const createPlatformEndpointResponse = await createPlatformEndpoint(createPlatformEndpointParams)
  logDebug('createPlatformEndpoint =>', createPlatformEndpointResponse)

  let userId
  const userDevice = {
    ...body,
    endpointArn: createPlatformEndpointResponse.EndpointArn
  } as UserDevice
  try {
    const table = process.env.DynamoDBTableUserDevices
    userId = getUserIdFromEvent(event as APIGatewayEvent)
    const userDeviceParams = queryUserDeviceParams(table, userId, userDevice)
    logDebug('query <=', userDeviceParams)
    const userDeviceResponse = await query(userDeviceParams)
    logDebug('query =>', userDeviceResponse)
    if (userDeviceResponse.Count === 1) {
      return response(context, 200, {endpointArn: userDevice.endpointArn})
    } else {
      // Store the device details associated with the user
      const updateUserDevice = updateUserDeviceParams(table, userId, userDevice)
      logDebug('updateItem <=', updateUserDevice)
      const updateUserDeviceResponse = await updateItem(updateUserDevice)
      logDebug('updateItem =>', updateUserDeviceResponse)
      // Confirm the subscription, and unsubscribe
      const listSubscriptionsByTopicParams = {
        TopicArn: process.env.PushNotificationTopicArn
      }
      logDebug('listSubscriptionsByTopic <=', listSubscriptionsByTopicParams)
      const listSubscriptionsByTopicResponse = await listSubscriptionsByTopic(listSubscriptionsByTopicParams)
      logDebug('listSubscriptionsByTopic =>', listSubscriptionsByTopicResponse)
      const result = listSubscriptionsByTopicResponse.Subscriptions.filter((subscription) => {
        return subscription.Endpoint === createPlatformEndpointResponse.EndpointArn
      })
      logDebug('unsubscribe <=')
      const unsubscribeResponse = await unsubscribe({
        SubscriptionArn: result[0].SubscriptionArn
      })
      logDebug('unsubscribe =>', unsubscribeResponse)
      return response(context, 201, {
        endpointArn: createPlatformEndpointResponse.EndpointArn
      })
    }
  } catch (error) {
    logError('error =', error)
    // If the user hasn't registered; add them to the unregistered topic
    const subscribeParams = {
      Endpoint: createPlatformEndpointResponse.EndpointArn,
      Protocol: 'application',
      TopicArn: process.env.PushNotificationTopicArn
    }
    logDebug('subscribe <=', subscribeParams)
    const subscribeResponse = await subscribe(subscribeParams)
    logDebug('subscribe =>', subscribeResponse)
  }
  return response(context, 200, {
    endpointArn: createPlatformEndpointResponse.EndpointArn
  })
}
