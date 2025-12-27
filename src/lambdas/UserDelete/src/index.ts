/**
 * UserDelete Lambda
 *
 * Deletes a user and all associated data (files, devices, subscriptions).
 * Implements cascade deletion with proper ordering to maintain referential integrity.
 *
 * Trigger: API Gateway DELETE /users
 * Input: Authenticated user context (userId from token)
 * Output: APIGatewayProxyResult confirming deletion
 */
import {Devices} from '#entities/Devices'
import {UserDevices} from '#entities/UserDevices'
import {UserFiles} from '#entities/UserFiles'
import {Users} from '#entities/Users'
import type {Device} from '#types/domain-models'
import {deleteDevice, getUserDevices} from '#lib/domain/device/device-service'
import {providerFailureErrorMessage, UnexpectedError} from '#lib/system/errors'
import {createFailedUserDeletionIssue} from '#lib/integrations/github/issue-service'
import {buildApiResponse} from '#lib/lambda/responses'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapAuthenticatedHandler} from '#lib/lambda/middleware/api'
import {logDebug, logError} from '#lib/system/logging'
import {retryUnprocessed, retryUnprocessedDelete} from '#lib/system/retry'

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

async function deleteUser(userId: string): Promise<void> {
  logDebug('deleteUser <=', userId)
  const response = await Users.delete({id: userId}).go()
  logDebug('deleteUser =>', response)
}

/**
 * Deletes a User and all associated data.
 * It does NOT delete the files themselves; this happens through a separate process.
 * @param event - An AWS ScheduledEvent; happening daily
 * @param context - An AWS Context object
 */
export const handler = withPowertools(wrapAuthenticatedHandler(async ({context, userId}) => {
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
  // 1. Delete junction/child tables first
  const relationResults = await Promise.allSettled([
    deleteUserFiles(userId),
    deleteUserDevices(userId)
  ])
  logDebug('Promise.allSettled (relations)', relationResults)

  // Check for failures in relations
  const relationFailures = relationResults.filter((r) => r.status === 'rejected')
  if (relationFailures.length > 0) {
    logError('Cascade deletion partial failure (relations)', relationFailures)
    return buildApiResponse(context, 207, {message: 'Partial deletion - some child records could not be removed', failedOperations: relationFailures.length})
  }

  // 2. Delete devices (parents of UserDevices)
  const deviceResults = await Promise.allSettled(deletableDevices.map((device) => deleteDevice(device)))
  logDebug('Promise.allSettled (devices)', deviceResults)

  const deviceFailures = deviceResults.filter((r) => r.status === 'rejected')
  if (deviceFailures.length > 0) {
    logError('Cascade deletion partial failure (devices)', deviceFailures)
    return buildApiResponse(context, 207, {message: 'Partial deletion - some devices could not be removed', failedOperations: deviceFailures.length})
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

  return buildApiResponse(context, 204)
}))
