import {APIGatewayProxyResult} from 'aws-lambda'
import {Users} from '#entities/Users'
import {UserFiles} from '#entities/UserFiles'
import {UserDevices} from '#entities/UserDevices'
import {Devices} from '#entities/Devices'
import type {ApiHandlerParams} from '#types/lambda-wrappers'
import {getUserDetailsFromEvent, logDebug, logError, response, wrapApiHandler} from '#util/lambda-helpers'
import {deleteDevice, getUserDevices} from '#util/shared'
import {providerFailureErrorMessage, UnexpectedError} from '#util/errors'
import {Device} from '#types/main'
import {createFailedUserDeletionIssue} from '#util/github-helpers'
import {withXRay} from '#lib/vendor/AWS/XRay'
import {retryUnprocessedDelete} from '#util/retry'
import {retryUnprocessed} from '#util/retry'

async function deleteUserFiles(userId: string): Promise<void> {
  logDebug('deleteUserFiles <=', userId)
  const userFiles = await UserFiles.query.byUser({userId}).go()
  if (userFiles.data && userFiles.data.length > 0) {
    const deleteKeys = userFiles.data.map((userFile) => ({userId: userFile.userId, fileId: userFile.fileId}))
    const {unprocessed} = await retryUnprocessedDelete(() => UserFiles.delete(deleteKeys).go({concurrency: 5}))
    if (unprocessed.length > 0) {
      logError('deleteUserFiles: failed to delete all items after retries', unprocessed)
    }
  }
  logDebug('deleteUserFiles => deleted', `${userFiles.data?.length || 0} records`)
}

async function deleteUser(userId: string): Promise<void> {
  logDebug('deleteUser <=', userId)
  const response = await Users.delete({userId}).go()
  logDebug('deleteUser =>', response)
}

async function deleteUserDevices(userId: string): Promise<void> {
  logDebug('deleteUserDevices <=', userId)
  const userDevices = await UserDevices.query.byUser({userId}).go()
  if (userDevices.data && userDevices.data.length > 0) {
    const deleteKeys = userDevices.data.map((userDevice) => ({userId: userDevice.userId, deviceId: userDevice.deviceId}))
    const {unprocessed} = await retryUnprocessedDelete(() => UserDevices.delete(deleteKeys).go({concurrency: 5}))
    if (unprocessed.length > 0) {
      logError('deleteUserDevices: failed to delete all items after retries', unprocessed)
    }
  }
  logDebug('deleteUserDevices => deleted', `${userDevices.data?.length || 0} records`)
}

/**
 * Deletes a User and all associated data.
 * It does NOT delete the files themselves; this happens through a separate process.
 * @param event - An AWS ScheduledEvent; happening daily
 * @param context - An AWS Context object
 */
export const handler = withXRay(wrapApiHandler(async ({event, context}: ApiHandlerParams): Promise<APIGatewayProxyResult> => {
  const {userId} = getUserDetailsFromEvent(event)
  if (!userId) {
    // This should never happen; enforced by the API Gateway Authorizer
    throw new UnexpectedError('No userId found')
  }
  const deletableDevices: Device[] = []

  const userDevices = await getUserDevices(userId)
  /* c8 ignore else */
  logDebug('Found userDevices', userDevices.length.toString())
  if (userDevices.length > 0) {
    const deviceKeys = userDevices.map((userDevice) => ({deviceId: userDevice.deviceId}))
    const {data: devices, unprocessed} = await retryUnprocessed(() => Devices.get(deviceKeys).go({concurrency: 5}))
    logDebug('Found devices', devices.length.toString())
    if (unprocessed.length > 0) {
      logError('getDevices: failed to fetch all items after retries', unprocessed)
    }
    if (!devices || devices.length === 0) {
      throw new UnexpectedError(providerFailureErrorMessage)
    }
    deletableDevices.push(...(devices as Device[]))
  }

  // Delete children FIRST (correct cascade order), then parent LAST
  const childResults = await Promise.allSettled([
    deleteUserFiles(userId),
    deleteUserDevices(userId),
    ...deletableDevices.map((device) => deleteDevice(device))
  ])
  logDebug('Promise.allSettled (children)', childResults)

  // Check for failures before deleting parent
  const failures = childResults.filter((r) => r.status === 'rejected')
  const hasPartialFailure = failures.length > 0

  if (hasPartialFailure) {
    logError('Cascade deletion partial failure', failures)
    // Don't delete parent if children failed - prevents orphaned records
    return response(context, 207, {
      message: 'Partial deletion - some child records could not be removed',
      failedOperations: failures.length,
      totalOperations: childResults.length
    })
  }

  // Delete parent LAST - only if all children succeeded
  try {
    await deleteUser(userId)
    logDebug('deleteUser completed')
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logError(`Failed to properly remove user ${userId}`, err.message)
    await createFailedUserDeletionIssue(userId, deletableDevices, err, context.awsRequestId)
    throw new UnexpectedError('Operation failed unexpectedly; but logged for resolution')
  }

  return response(context, 204)
}))
