/**
 * User Deletion Service
 *
 * Cascade deletion operations for user account removal.
 * Handles junction table cleanup and parent record deletion.
 */
import {deleteUser as deleteUserRecord, deleteUserDevicesByUserId, deleteUserFilesByUserId} from '#entities/queries'
import {logDebug} from '@mantleframework/observability'

/** Delete all user-file relationships */
export async function deleteUserFiles(userId: string): Promise<void> {
  logDebug('deleteUserFiles', {userId})
  await deleteUserFilesByUserId(userId)
  logDebug('deleteUserFiles completed')
}

/** Delete all user-device relationships */
export async function deleteUserDevicesRelations(userId: string): Promise<void> {
  logDebug('deleteUserDevices', {userId})
  await deleteUserDevicesByUserId(userId)
  logDebug('deleteUserDevices completed')
}

/** Delete user record */
export async function deleteUser(userId: string): Promise<void> {
  logDebug('deleteUser', {userId})
  await deleteUserRecord(userId)
  logDebug('deleteUser completed')
}
