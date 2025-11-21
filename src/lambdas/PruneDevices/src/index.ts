import {ScheduledEvent, Context, APIGatewayProxyResult} from 'aws-lambda'
import {logDebug, logError, logInfo, response} from '../../../util/lambda-helpers'
import {scan} from '../../../lib/vendor/AWS/DynamoDB'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors'
import {ApplePushNotificationResponse, Device, DynamoDBUserDevice} from '../../../types/main'
import {getUsersByDeviceId} from '../../../util/dynamodb-helpers'
import {deleteDevice, deleteUserDevice} from '../../../util/shared'
import {assertIsError} from '../../../util/transformers'
import {ApnsClient, Notification, PushType, Priority} from 'apns2'
import {Apns2Error} from '../../../util/errors'
import {getApnsSigningKey} from '../../../util/secretsmanager-helpers'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

/**
 * Returns an array of filesIds that are ready to be downloaded
 * @notExported
 */
async function getDevices(): Promise<Device[]> {
  logDebug('getDevices <=')
  const scanResponse = await scan({TableName: process.env.DynamoDBTableDevices as string})
  logDebug('getDevices =>', scanResponse)
  if (!scanResponse || !scanResponse.Items) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return scanResponse.Items as Device[]
}

async function isDeviceDisabled(token: string): Promise<boolean> {
  const apnsResponse = await dispatchHealthCheckNotificationToDeviceToken(token)
  return apnsResponse.statusCode === 410
}

async function dispatchHealthCheckNotificationToDeviceToken(token: string): Promise<ApplePushNotificationResponse> {
  logInfo('dispatchHealthCheckNotificationToDeviceToken')
  const signingKey = await getApnsSigningKey()
  const client = new ApnsClient({
    team: process.env.ApnsTeam as string,
    keyId: process.env.ApnsKeyId as string,
    signingKey,
    defaultTopic: process.env.ApnsDefaultTopic as string,
    host: 'api.sandbox.push.apple.com'
  })
  const healthCheckNotification = new Notification(token, {
    contentAvailable: true,
    type: PushType.background,
    priority: Priority.throttled,
    aps: {
      health: 'check'
    }
  })
  try {
    logDebug('apnProvider.send <=', healthCheckNotification)
    const result = await client.send(healthCheckNotification)
    logDebug('apnProvider.send =>', result)
    return {statusCode: 200}
  } catch (err) {
    logError('apnProvider.send =>', err as object)
    if (err && typeof err === 'object' && 'reason' in err) {
      const apnsError = err as Apns2Error
      return {statusCode: Number(apnsError.statusCode), reason: apnsError.reason}
    } else {
      throw new UnexpectedError('Unexpected result from APNS')
    }
  }
}

async function getUserIdsByDeviceId(deviceId: string): Promise<string[]> {
  const params = getUsersByDeviceId(process.env.DynamoDBTableUserDevices as string, deviceId)
  logDebug('getUserIdsByDeviceId <=', params)
  const response = await scan(params)
  logDebug('getUserIdsByDeviceId <=', response)
  if (!response || !response.Items) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  const userDevices = response.Items as DynamoDBUserDevice[]
  return userDevices.map((userDevice) => userDevice.userId)
}

/**
 * Removes Devices and related data if the device is no longer active.
 * Activity is determined by directly querying the APNS.
 * - If the device is disabled, remove the platform endpoint and device data
 * - If the device is associated with a user, remove it from UserDevices
 * {@label PRUNE_DEVICES_HANDLER}
 * @param event - An AWS ScheduledEvent; happening daily
 * @param context - An AWS Context object
 * @notExported
 */
export const handler = withXRay(async (event: ScheduledEvent, context: Context, {traceId: _traceId}): Promise<APIGatewayProxyResult> => {
  logInfo('event <=', event)
  const devices = await getDevices()
  for (const device of devices) {
    const deviceId = device.deviceId
    logInfo('Verifying device', deviceId)
    if (await isDeviceDisabled(device.token)) {
      try {
        // Unbelievably, all these methods are idempotent
        const userIds = await getUserIdsByDeviceId(deviceId)
        const values = await Promise.all([deleteDevice(device), userIds.map((userId) => deleteUserDevice(userId, deviceId))])
        logDebug('Promise.all', values)
      } catch (error) {
        assertIsError(error)
        logError(`Failed to properly remove device ${deviceId}`, error.message)
        // TODO: Trigger severe alarm with device details and requestId so it can be manually deleted later
      }
    }
  }
  return response(context, 200)
})
