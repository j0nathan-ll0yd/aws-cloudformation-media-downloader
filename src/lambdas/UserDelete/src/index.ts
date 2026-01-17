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
import type {APIGatewayProxyResult, Context} from 'aws-lambda'
import {deleteUser as deleteUserRecord, deleteUserDevicesByUserId, deleteUserFilesByUserId, getDevicesBatch} from '#entities/queries'
import type {Device} from '#types/domainModels'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'
import {DatabaseOperation, DatabaseTable} from '#types/databasePermissions'
import {AuthenticatedHandler, RequiresDatabase} from '#lib/lambda/handlers'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {createFailedUserDeletionIssue} from '#lib/integrations/github/issueService'
import {deleteDevice, getUserDevices} from '#lib/services/device/deviceService'
import {providerFailureErrorMessage, UnexpectedError} from '#lib/system/errors'
import {logDebug, logError} from '#lib/system/logging'

/** Delete all user-file relationships */
async function deleteUserFiles(userId: string): Promise<void> {
  logDebug('deleteUserFiles <=', userId)
  await deleteUserFilesByUserId(userId)
  logDebug('deleteUserFiles => completed')
}

/** Delete all user-device relationships */
async function deleteUserDevicesRelations(userId: string): Promise<void> {
  logDebug('deleteUserDevices <=', userId)
  await deleteUserDevicesByUserId(userId)
  logDebug('deleteUserDevices => completed')
}

/** Delete user record */
async function deleteUser(userId: string): Promise<void> {
  logDebug('deleteUser <=', userId)
  await deleteUserRecord(userId)
  logDebug('deleteUser => completed')
}

/**
 * Handler for user deletion with cascade
 * Deletes user files, devices, and finally the user record
 */
@RequiresDatabase({
  tables: [
    {table: DatabaseTable.Users, operations: [DatabaseOperation.Delete]},
    {table: DatabaseTable.Devices, operations: [DatabaseOperation.Select, DatabaseOperation.Delete]},
    {table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Select, DatabaseOperation.Delete]},
    {table: DatabaseTable.UserDevices, operations: [DatabaseOperation.Select, DatabaseOperation.Delete]}
  ]
})
class UserDeleteHandler extends AuthenticatedHandler {
  readonly operationName = 'UserDelete'

  protected async handleAuthenticated(_event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> {
    const deletableDevices: Device[] = []

    const userDevices = await getUserDevices(this.userId)
    logDebug('Found userDevices', userDevices.length.toString())
    if (userDevices.length > 0) {
      const deviceIds = userDevices.map((userDevice) => userDevice.deviceId)
      const devices = await getDevicesBatch(deviceIds)
      logDebug('Found devices', devices.length.toString())
      if (devices.length === 0) {
        throw new UnexpectedError(providerFailureErrorMessage)
      }
      deletableDevices.push(...(devices as Device[]))
    }

    // Delete children FIRST (correct cascade order), then parent LAST
    // 1. Delete junction/child tables first
    const relationResults = await Promise.allSettled([
      deleteUserFiles(this.userId),
      deleteUserDevicesRelations(this.userId)
    ])
    logDebug('Promise.allSettled (relations)', relationResults)

    // Check for failures in relations
    const relationFailures = relationResults.filter((r) => r.status === 'rejected')
    if (relationFailures.length > 0) {
      logError('Cascade deletion partial failure (relations)', relationFailures)
      return buildValidatedResponse(context, 207, {
        message: 'Partial deletion - some child records could not be removed',
        failedOperations: relationFailures.length
      })
    }

    // 2. Delete devices (parents of UserDevices)
    const deviceResults = await Promise.allSettled(deletableDevices.map((device) => deleteDevice(device)))
    logDebug('Promise.allSettled (devices)', deviceResults)

    const deviceFailures = deviceResults.filter((r) => r.status === 'rejected')
    if (deviceFailures.length > 0) {
      logError('Cascade deletion partial failure (devices)', deviceFailures)
      return buildValidatedResponse(context, 207, {message: 'Partial deletion - some devices could not be removed', failedOperations: deviceFailures.length})
    }

    // Delete parent LAST - only if all children succeeded
    try {
      await deleteUser(this.userId)
      logDebug('deleteUser completed')
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logError(`Failed to properly remove user ${this.userId}`, err.message)
      await createFailedUserDeletionIssue(this.userId, deletableDevices, err, context.awsRequestId)
      throw new UnexpectedError('Operation failed unexpectedly; but logged for resolution')
    }

    this.addMetadata('devicesDeleted', deletableDevices.length)
    return buildValidatedResponse(context, 204)
  }
}

const handlerInstance = new UserDeleteHandler()
export const handler = handlerInstance.handler.bind(handlerInstance)
