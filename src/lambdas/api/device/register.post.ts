/**
 * RegisterDevice Lambda
 *
 * Registers iOS devices for push notifications via APNS.
 * Creates platform endpoint and subscribes to notification topics.
 *
 * Trigger: API Gateway POST /device/register
 * Input: DeviceRegistrationRequest with device token
 * Output: APIGatewayProxyResult with device registration
 *
 * @see {@link ../../../services/device/registrationService.ts} for registration helpers
 */
import {buildValidatedResponse, UserStatus} from '@mantleframework/core'
import {getRequiredEnv} from '@mantleframework/env'
import {defineApiHandler, z} from '@mantleframework/validation'
import {getUserDevices, subscribeEndpointToTopic, unsubscribeEndpointToTopic} from '#services/device/deviceService'
import {createPlatformEndpointFromToken, getSubscriptionArnFromEndpointAndTopic, upsertDevice, upsertUserDevices} from '#services/device/registrationService'
import {deviceRegistrationResponseSchema} from '#types/api-schema'
import type {Device} from '#types/domainModels'
import {verifyPlatformConfiguration} from '#utils/platform-config'

const DeviceRegistrationRequestSchema = z.object({
  deviceId: z.string(),
  token: z.string(),
  name: z.string().optional(),
  systemVersion: z.string().optional(),
  systemName: z.string().optional()
})

const api = defineApiHandler({auth: 'authorizer-optional', schema: DeviceRegistrationRequestSchema, operationName: 'RegisterDevice'})
export const handler = api(async ({context, userId, userStatus, body}) => {
  verifyPlatformConfiguration()

  const platformEndpoint = await createPlatformEndpointFromToken(body.token)
  const pushNotificationTopicArn = getRequiredEnv('PUSH_NOTIFICATION_TOPIC_ARN')
  const device = {...body, endpointArn: platformEndpoint.EndpointArn} as Device
  await upsertDevice(device)

  /* c8 ignore else */
  if (userStatus === UserStatus.Authenticated && userId) {
    await upsertUserDevices(userId, body.deviceId)
    const userDevices = await getUserDevices(userId)
    if (userDevices.length === 1) {
      return buildValidatedResponse(context, 200, {endpointArn: device.endpointArn}, deviceRegistrationResponseSchema)
    } else {
      const subscriptionArn = await getSubscriptionArnFromEndpointAndTopic(device.endpointArn, pushNotificationTopicArn)
      await unsubscribeEndpointToTopic(subscriptionArn)
      return buildValidatedResponse(context, 201, {endpointArn: platformEndpoint.EndpointArn}, deviceRegistrationResponseSchema)
    }
  } else if (userStatus === UserStatus.Anonymous) {
    await subscribeEndpointToTopic(device.endpointArn, pushNotificationTopicArn)
  }

  return buildValidatedResponse(context, 200, {endpointArn: device.endpointArn}, deviceRegistrationResponseSchema)
})
