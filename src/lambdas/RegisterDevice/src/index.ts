/**
 * RegisterDevice Lambda
 *
 * Registers iOS devices for push notifications via APNS.
 * Creates platform endpoint and subscribes to notification topics.
 *
 * Trigger: API Gateway POST /devices
 * Input: DeviceRegistrationRequest with device token
 * Output: APIGatewayProxyResult with device registration
 */
import type {APIGatewayProxyResult, Context} from 'aws-lambda'
import {upsertDevice as upsertDeviceRecord, upsertUserDevice} from '#entities/queries'
import {createPlatformEndpoint, listSubscriptionsByTopic} from '#lib/vendor/AWS/SNS'
import {DatabaseOperation, DatabaseTable} from '#types/databasePermissions'
import {UserStatus} from '#types/enums'
import {deviceRegistrationRequestSchema, deviceRegistrationResponseSchema} from '#types/api-schema'
import type {DeviceRegistrationRequest} from '#types/api-schema'
import type {Device} from '#types/domainModels'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'
import {AWSService, SNSOperation, SNSPlatformResource} from '#types/servicePermissions'
import {OptionalAuthHandler, RequiresDatabase, RequiresServices} from '#lib/lambda/handlers'
import {getPayloadFromEvent, validateRequest} from '#lib/lambda/middleware/apiGateway'
import {getUserDevices, subscribeEndpointToTopic, unsubscribeEndpointToTopic} from '#lib/services/device/deviceService'
import {getRequiredEnv} from '#lib/system/env'
import {providerFailureErrorMessage, ServiceUnavailableError, UnexpectedError} from '#lib/system/errors'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {verifyPlatformConfiguration} from '#lib/lambda/context'
import {logDebug} from '#lib/system/logging'

/** Creates platform endpoint from device token */
async function createPlatformEndpointFromToken(token: string) {
  const params = {PlatformApplicationArn: getRequiredEnv('PLATFORM_APPLICATION_ARN'), Token: token}
  logDebug('createPlatformEndpoint <=', params)
  const createPlatformEndpointResponse = await createPlatformEndpoint(params)
  if (!createPlatformEndpointResponse) {
    throw new ServiceUnavailableError('AWS failed to respond')
  }
  logDebug('createPlatformEndpoint =>', createPlatformEndpointResponse)
  return createPlatformEndpointResponse
}

/** Store user-device relationship */
async function upsertUserDevices(userId: string, deviceId: string) {
  logDebug('upsertUserDevices <=', {userId, deviceId})
  const response = await upsertUserDevice({userId, deviceId})
  logDebug('upsertUserDevices =>', response)
  return response
}

/** Store device details */
async function upsertDevice(device: Device) {
  logDebug('upsertDevice <=', device)
  const response = await upsertDeviceRecord({
    deviceId: device.deviceId,
    endpointArn: device.endpointArn,
    token: device.token,
    name: device.name,
    systemVersion: device.systemVersion,
    systemName: device.systemName
  })
  logDebug('upsertDevice =>', response)
  return response
}

/** Gets subscription ARN for an endpoint */
async function getSubscriptionArnFromEndpointAndTopic(endpointArn: string, topicArn: string): Promise<string> {
  const listSubscriptionsByTopicParams = {TopicArn: topicArn}
  logDebug('getSubscriptionArnFromEndpointAndTopic <=', listSubscriptionsByTopicParams)
  const listSubscriptionsByTopicResponse = await listSubscriptionsByTopic(listSubscriptionsByTopicParams)
  logDebug('getSubscriptionArnFromEndpointAndTopic =>', listSubscriptionsByTopicResponse)
  if (!listSubscriptionsByTopicResponse || !listSubscriptionsByTopicResponse.Subscriptions) {
    throw new ServiceUnavailableError(providerFailureErrorMessage)
  }
  const result = listSubscriptionsByTopicResponse.Subscriptions.filter((subscription) => {
    return subscription.Endpoint === endpointArn
  })
  if (!result || result.length === 0 || !result[0].SubscriptionArn) {
    throw new UnexpectedError('Invalid subscription response')
  }
  return result[0].SubscriptionArn
}

/**
 * Handler for device registration
 * Registers devices for push notifications via AWS SNS
 */
@RequiresDatabase([
  {table: DatabaseTable.Devices, operations: [DatabaseOperation.Select, DatabaseOperation.Insert, DatabaseOperation.Update]},
  {table: DatabaseTable.UserDevices, operations: [DatabaseOperation.Select, DatabaseOperation.Insert, DatabaseOperation.Update]}
])
@RequiresServices([
  {service: AWSService.SNS, resource: SNSPlatformResource.OfflineMediaDownloader, operations: [SNSOperation.Publish, SNSOperation.Subscribe]}
])
class RegisterDeviceHandler extends OptionalAuthHandler {
  readonly operationName = 'RegisterDevice'

  protected async handleRequest(event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> {
    this.addAnnotation('userStatus', String(this.userStatus))

    verifyPlatformConfiguration()
    const requestBody = getPayloadFromEvent(event) as DeviceRegistrationRequest
    validateRequest(requestBody, deviceRegistrationRequestSchema)
    this.addAnnotation('deviceId', requestBody.deviceId)

    const platformEndpoint = await createPlatformEndpointFromToken(requestBody.token)
    const pushNotificationTopicArn = getRequiredEnv('PUSH_NOTIFICATION_TOPIC_ARN')
    const device = {...requestBody, endpointArn: platformEndpoint.EndpointArn} as Device
    // Store the device details, regardless of user status
    await upsertDevice(device)

    /* c8 ignore else */
    if (this.userStatus === UserStatus.Authenticated && this.userId) {
      this.addAnnotation('userId', this.userId)
      // Store the device details associated with the user
      await upsertUserDevices(this.userId, requestBody.deviceId)
      // Determine if the user already exists
      const userDevices = await getUserDevices(this.userId)
      if (userDevices.length === 1) {
        this.addMetadata('firstDevice', true)
        return buildValidatedResponse(context, 200, {endpointArn: device.endpointArn}, deviceRegistrationResponseSchema)
      } else {
        // Confirm the subscription, and unsubscribe
        const subscriptionArn = await getSubscriptionArnFromEndpointAndTopic(device.endpointArn, pushNotificationTopicArn)
        await unsubscribeEndpointToTopic(subscriptionArn)
        this.addMetadata('unsubscribed', true)
        return buildValidatedResponse(context, 201, {endpointArn: platformEndpoint.EndpointArn}, deviceRegistrationResponseSchema)
      }
    } else if (this.userStatus === UserStatus.Anonymous) {
      // If the user hasn't registered; add them to the unregistered topic
      await subscribeEndpointToTopic(device.endpointArn, pushNotificationTopicArn)
      this.addMetadata('subscribedToTopic', true)
    }

    return buildValidatedResponse(context, 200, {endpointArn: device.endpointArn}, deviceRegistrationResponseSchema)
  }
}

const handlerInstance = new RegisterDeviceHandler()
export const handler = handlerInstance.handler.bind(handlerInstance)
