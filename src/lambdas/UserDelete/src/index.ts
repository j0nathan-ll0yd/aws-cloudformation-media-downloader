import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {getUserDetailsFromEvent, lambdaErrorResponse, logDebug, logError, logInfo, response} from '../../../util/lambda-helpers'
import {deleteAllUserDeviceParams, deleteUserFilesParams, deleteUserParams, getDeviceParams} from '../../../util/dynamodb-helpers'
import {deleteItem, query, updateItem} from '../../../lib/vendor/AWS/DynamoDB'
import {deleteDevice, getUserDevices} from '../../../util/shared'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors'
import {Device} from '../../../types/main'
import {assertIsError} from '../../../util/transformers'
import {createFailedUserDeletionIssue} from '../../../util/github-helpers'

async function deleteUserFiles(userId: string): Promise<void> {
  const params = deleteUserFilesParams(process.env.DynamoDBTableUserFiles as string, userId)
  logDebug('deleteUserFiles <=', params)
  const response = await updateItem(params)
  logDebug('deleteUserFiles =>', response)
}

async function deleteUser(deviceId: string): Promise<void> {
  const params = deleteUserParams(process.env.DynamoDBTableUsers as string, deviceId)
  logDebug('deleteUser <=', params)
  const response = await deleteItem(params)
  logDebug('deleteUser =>', response)
}

async function deleteUserDevices(userId: string): Promise<void> {
  const params = deleteAllUserDeviceParams(process.env.DynamoDBTableUserDevices as string, userId)
  logDebug('deleteUserDevices <=', params)
  const response = await deleteItem(params)
  logDebug('deleteUserDevices =>', response)
}

async function getDevice(deviceId: string): Promise<Device> {
  const params = getDeviceParams(process.env.DynamoDBTableDevices as string, deviceId)
  logDebug('getDevice <=', params)
  const response = await query(params)
  logDebug('getDevice <=', response)
  if (response && response.Items) {
    return response.Items[0] as unknown as Device
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
export async function handler(event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> {
  logInfo('event <=', event)
  const {userId} = getUserDetailsFromEvent(event as APIGatewayEvent)
  if (!userId) {
    // This should never happen; enforced by the API Gateway Authorizer
    const error = new UnexpectedError('No userId found')
    return lambdaErrorResponse(context, error)
  }
  const deletableDevices: Device[] = []
  try {
    const userDevices = await getUserDevices(process.env.DynamoDBTableUserDevices as string, userId)
    /* istanbul ignore else */
    if (userDevices.length > 0) {
      for (const row of userDevices) {
        const devices = row.devices.values as string[]
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
}
