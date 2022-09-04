import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {updateItem, query} from '../../../lib/vendor/AWS/DynamoDB'
import {createPlatformEndpoint, listSubscriptionsByTopic, unsubscribe} from '../../../lib/vendor/AWS/SNS'
import {DeviceRegistration, UserDevice} from '../../../types/main'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {registerDeviceConstraints} from '../../../util/constraints'
import {queryUserDeviceParams, updateUserDeviceParams} from '../../../util/dynamodb-helpers'
import {getUserIdFromEvent, lambdaErrorResponse, logDebug, logError, logInfo, response, subscribeEndpointToTopic, verifyPlatformConfiguration} from '../../../util/lambda-helpers'
import {SubscriptionsList} from 'aws-sdk/clients/sns'
import { providerFailureErrorMessage, UnexpectedError } from "../../../util/errors"

/**
 * An idempotent operation that creates an endpoint for a device on one of the supported services (e.g. GCP, APNS)
 * @param token - The client device token
 * @notExported
 */
async function createPlatformEndpointFromToken(token: string) {
  // An idempotent option that creates an endpoint for a device on one of the supported services (e.g. GCP, APNS)
  const params = {
    PlatformApplicationArn: process.env.PlatformApplicationArn as string,
    Token: token
  }
  logDebug('createPlatformEndpoint <=', params)
  const createPlatformEndpointResponse = await createPlatformEndpoint(params)
  logDebug('createPlatformEndpoint =>', params)
  return createPlatformEndpointResponse
}

/**
 * Queries a user's device parameters from DynamoDB
 * @param table - The DynamoDB table to perform the operation on
 * @param userId - The userId
 * @param userDevice - The UserDevice details (e.g. endpointArn)
 * @notExported
 */
async function getUserDevice(table: string, userId: string, userDevice: UserDevice) {
  const params = queryUserDeviceParams(table, userId, userDevice)
  logDebug('getUserDevice <=', params)
  const response = await query(params)
  logDebug('getUserDevice =>', response)
  return response
}

/**
 * Unsubscribes an endpoint (a client device) to an SNS topic
 * @param subscriptionArn - The SubscriptionArn of a endpoint+topic
 */
export async function unsubscribeEndpointToTopic(subscriptionArn: string) {
  logDebug('unsubscribeEndpointToTopic <=')
  const response = await unsubscribe({SubscriptionArn: subscriptionArn})
  logDebug('unsubscribeEndpointToTopic =>', response)
  return response
}

/**
 * Store the device details associated with the user (e.g. iPhone, Android) and stores it to DynamoDB
 * @param table - The DynamoDB table to perform the operation on
 * @param userId - The userId
 * @param userDevice - The UserDevice details (e.g. endpointArn)
 * @notExported
 */
async function upsertUserDevice(table: string, userId: string, userDevice: UserDevice) {
  const params = updateUserDeviceParams(table, userId, userDevice)
  logDebug('upsertUserDevice <=', params)
  const response = await updateItem(params)
  logDebug('upsertUserDevice =>', params)
  return response
}

/**
 * Store the device details associated with the user (e.g. iPhone, Android) and stores it to DynamoDB
 * @param endpointArn - The userId
 * @param topicArn - The UserDevice details (e.g. endpointArn)
 * @notExported
 */
async function getSubscriptionArnFromEndpointAndTopic(endpointArn: string, topicArn: string): Promise<string> {
  const listSubscriptionsByTopicParams = {TopicArn: topicArn}
  logDebug('getSubscriptionArnFromEndpointAndTopic <=', listSubscriptionsByTopicParams)
  const listSubscriptionsByTopicResponse = await listSubscriptionsByTopic(listSubscriptionsByTopicParams)
  logDebug('getSubscriptionArnFromEndpointAndTopic =>', listSubscriptionsByTopicResponse)
  if (!listSubscriptionsByTopicResponse.Subscriptions) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  const result = listSubscriptionsByTopicResponse.Subscriptions.filter((subscription) => {
    return subscription.Endpoint === endpointArn
  }) as SubscriptionsList
  if (!result[0].SubscriptionArn) {
    throw new UnexpectedError('Invalid subscription response')
  }
  return result[0].SubscriptionArn
}

/**
 * Registers a UserDevice (e.g. iPhone) to receive push notifications via AWS SNS
 * @notExported
 */
export async function handler(event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> {
  logInfo('event <=', event)
  let requestBody
  try {
    verifyPlatformConfiguration()
    requestBody = getPayloadFromEvent(event) as DeviceRegistration
    validateRequest(requestBody, registerDeviceConstraints)
  } catch (error) {
    return lambdaErrorResponse(context, error)
  }

  const platformEndpoint = await createPlatformEndpointFromToken(requestBody.token)
  const pushNotificationTopicArn = process.env.PushNotificationTopicArn as string

  let userId
  const userDevice = {
    ...requestBody,
    endpointArn: platformEndpoint.EndpointArn
  } as UserDevice
  try {
    userId = getUserIdFromEvent(event as APIGatewayEvent)
    const table = process.env.DynamoDBTableUserDevices as string
    const userDeviceResponse = await getUserDevice(table, userId, userDevice)
    if (userDeviceResponse.Count === 1) {
      return response(context, 200, {endpointArn: userDevice.endpointArn})
    } else {
      // Store the device details associated with the user
      await upsertUserDevice(table, userId, userDevice)
      // Confirm the subscription, and unsubscribe
      const subscriptionArn = await getSubscriptionArnFromEndpointAndTopic(userDevice.endpointArn, pushNotificationTopicArn)
      await unsubscribeEndpointToTopic(subscriptionArn)
      return response(context, 201, {
        endpointArn: platformEndpoint.EndpointArn
      })
    }
  } catch (error) {
    logError('error =', error)
    // If the user hasn't registered; add them to the unregistered topic
    await subscribeEndpointToTopic(userDevice.endpointArn, pushNotificationTopicArn)
  }
  return response(context, 200, {
    endpointArn: platformEndpoint.EndpointArn
  })
}
