import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {Users} from '../../../entities/Users'
import {UserFiles} from '../../../entities/UserFiles'
import {UserDevices} from '../../../entities/UserDevices'
import {Devices} from '../../../entities/Devices'
import {getUserDetailsFromEvent, lambdaErrorResponse, logDebug, logError, logInfo, response} from '../../../util/lambda-helpers'
import {deleteDevice, getUserDevices} from '../../../util/shared'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors'
import {CustomAPIGatewayRequestAuthorizerEvent, Device} from '../../../types/main'
import {assertIsError} from '../../../util/transformers'
import {createFailedUserDeletionIssue} from '../../../util/github-helpers'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

async function deleteUserFiles(userId: string): Promise<void> {
  logDebug('deleteUserFiles <=', userId)
  const response = await UserFiles.delete({userId}).go()
  logDebug('deleteUserFiles =>', response)
}

async function deleteUser(userId: string): Promise<void> {
  logDebug('deleteUser <=', userId)
  const response = await Users.delete({userId}).go()
  logDebug('deleteUser =>', response)
}

async function deleteUserDevices(userId: string): Promise<void> {
  logDebug('deleteUserDevices <=', userId)
  const response = await UserDevices.delete({userId}).go()
  logDebug('deleteUserDevices =>', response)
}

async function getDevice(deviceId: string): Promise<Device> {
  logDebug('getDevice <=', deviceId)
  const response = await Devices.get({deviceId}).go()
  logDebug('getDevice =>', response)
  if (response && response.data) {
    return response.data as Device
  } else {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
}

/**
 * Deletes a User and all associated data.
 * It does NOT delete the files themselves; this happens through a separate process.
 * @param event - An AWS ScheduledEvent; happening daily
 * @param context - An AWS Context object
 */
export const handler = withXRay(async (event: CustomAPIGatewayRequestAuthorizerEvent, context: Context, {traceId: _traceId}): Promise<APIGatewayProxyResult> => {
  logInfo('event <=', event)
  const {userId} = getUserDetailsFromEvent(event)
  if (!userId) {
    // This should never happen; enforced by the API Gateway Authorizer
    const error = new UnexpectedError('No userId found')
    return lambdaErrorResponse(context, error)
  }
  const deletableDevices: Device[] = []
  try {
    const userDevices = await getUserDevices(userId)
    /* istanbul ignore else */
    logDebug('Found userDevices', userDevices.length.toString())
    if (userDevices.length > 0) {
      for (const row of userDevices) {
        const devicesSet = row.devices as Set<string>
        const devices = Array.from(devicesSet.values()) as string[]
        for (const deviceId of devices) {
          const device = await getDevice(deviceId)
          deletableDevices.push(device)
        }
      }
    }
  } catch (error) {
    assertIsError(error)
    return lambdaErrorResponse(context, new UnexpectedError('Service unavailable; try again later'))
  }
  try {
    // Now that all the delete operations are queued; perform the deletion
    const values = await Promise.all([deleteUserFiles(userId), deleteUserDevices(userId), deleteUser(userId), deletableDevices.map((device) => deleteDevice(device))])
    logDebug('Promise.all', values)
    return response(context, 204)
  } catch (error) {
    assertIsError(error)
    logError(`Failed to properly remove user ${userId}`, error.message)
    await createFailedUserDeletionIssue(userId, deletableDevices, error, context.awsRequestId)
    return lambdaErrorResponse(context, new UnexpectedError('Operation failed unexpectedly; but logged for resolution'))
  }
})
