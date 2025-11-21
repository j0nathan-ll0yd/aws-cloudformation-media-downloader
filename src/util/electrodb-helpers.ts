/**
 * ElectroDB Helper Functions
 *
 * This file provides ElectroDB-based query builders that replace the DynamoDB helper functions.
 * These functions maintain API compatibility while leveraging ElectroDB's SQL-like syntax.
 */

import {DynamoDBFile, User, Device, IdentityProviderApple} from '../types/main'
import {Files, Users, Devices, UserFiles, UserDevices, addFileToUser, addDeviceToUser, removeDeviceFromUser} from '../lib/vendor/ElectroDB/service'

// ========================================
// Files Table Operations
// ========================================

/**
 * Update a file with completed download URL and status
 * Replaces: updateCompletedFileParams
 */
export async function updateCompletedFile(fileId: string, fileUrl: string) {
  return Files.update({fileId})
    .set({
      url: fileUrl,
      status: 'Downloaded' as const
    })
    .go({response: 'all_new'})
}

/**
 * Scan for files that are ready for download but not yet downloaded
 * Replaces: scanForFileParams
 */
export async function scanForPendingFiles() {
  const currentTime = Date.now()

  // Use scan with filter for files where availableAt <= now AND url doesn't exist
  return Files.scan
    .where(({availableAt}, {lte}) => lte(availableAt, currentTime))
    .where(({url}, {notExists}) => notExists(url))
    .go({
      attributes: ['availableAt', 'fileId'] // ProjectionExpression equivalent
    })
}

/**
 * Get a file by its S3 key
 * Replaces: getFileByKey
 */
export async function getFileByKey(fileName: string) {
  // This requires a scan since key is not indexed
  return Files.scan.where(({key}, {eq}) => eq(key, fileName)).go()
}

/**
 * Query a file by its ID
 * Replaces: queryFileParams
 */
export async function queryFile(fileId: string) {
  return Files.get({fileId}).go()
}

/**
 * Create or update a new file with pending metadata status
 * Replaces: newFileParams
 */
export async function createNewFile(fileId: string) {
  return Files.update({fileId})
    .set({
      availableAt: Date.now(),
      status: 'PendingMetadata' as const
    })
    .go({response: 'all_old'})
}

/**
 * Update file metadata
 * Replaces: updateFileMetadataParams
 */
export async function updateFileMetadata(item: DynamoDBFile) {
  const {fileId, ...updates} = item
  return Files.update({fileId})
    .set(updates as any) // ElectroDB will handle the type checking
    .go()
}

/**
 * Batch get multiple files by their IDs
 * Replaces: getBatchFilesParams
 */
export async function getBatchFiles(fileIds: string[]) {
  // Remove duplicates
  const uniqueFileIds = Array.from(new Set(fileIds))

  // ElectroDB batch get
  const keys = uniqueFileIds.map((fileId) => ({fileId}))
  return Files.get(keys).go()
}

// ========================================
// Users Table Operations
// ========================================

/**
 * Create a new user
 * Replaces: newUserParams
 */
export async function createNewUser(user: User, identityProviderApple: IdentityProviderApple) {
  return Users.create({
    ...user,
    identityProviders: {...identityProviderApple}
  }).go()
}

/**
 * Get a user by Apple device identifier
 * Replaces: getUserByAppleDeviceIdentifierParams
 */
export async function getUserByAppleDeviceIdentifier(appleUserId: string) {
  // ElectroDB doesn't natively support nested field queries in scan
  // Filter in memory for now
  const allUsers = await Users.scan.go()
  return {
    data: allUsers.data.filter((user) => user.identityProviders?.userId === appleUserId)
  }
}

/**
 * Delete a user
 * Replaces: deleteUserParams
 */
export async function deleteUser(userId: string) {
  return Users.delete({userId}).go()
}

// ========================================
// Devices Table Operations
// ========================================

/**
 * Upsert a device (create or update)
 * Replaces: upsertDeviceParams
 */
export async function upsertDevice(device: Device) {
  const {deviceId, ...deviceData} = device
  return Devices.upsert({
    deviceId,
    ...deviceData
  }).go()
}

/**
 * Query a device by its ID
 * Replaces: queryDeviceParams / getDeviceParams
 */
export async function queryDevice(deviceId: string) {
  return Devices.get({deviceId}).go()
}

/**
 * Delete a device
 * Replaces: deleteDeviceParams
 */
export async function deleteDevice(deviceId: string) {
  return Devices.delete({deviceId}).go()
}

// ========================================
// UserFiles Table Operations
// ========================================

/**
 * Add a file to a user's file set (atomic operation)
 * Replaces: userFileParams
 */
export async function addUserFile(userId: string, fileId: string) {
  return addFileToUser(userId, fileId)
}

/**
 * Get user's files
 * Replaces: getUserFilesParams
 */
export async function getUserFiles(userId: string) {
  return UserFiles.get({userId}).go()
}

/**
 * Get users who have access to a specific file
 * Replaces: getUsersByFileId
 */
export async function getUsersByFileId(fileId: string) {
  // This requires scanning with a contains filter
  // ElectroDB doesn't have native support for contains on sets, so we'll use raw DynamoDB
  // For now, return all UserFiles and filter in memory
  const allUserFiles = await UserFiles.scan.go()
  return {
    data: allUserFiles.data.filter((uf) => uf.fileId && (uf.fileId as string[]).includes(fileId))
  }
}

/**
 * Delete user's files
 * Replaces: deleteUserFilesParams
 */
export async function deleteUserFiles(userId: string) {
  return UserFiles.delete({userId}).go()
}

// ========================================
// UserDevices Table Operations
// ========================================

/**
 * Add a device to a user's device set (atomic operation)
 * Replaces: userDevicesParams
 */
export async function addUserDevice(userId: string, deviceId: string) {
  return addDeviceToUser(userId, deviceId)
}

/**
 * Remove a device from a user's device set (atomic operation)
 * Replaces: deleteSingleUserDeviceParams
 */
export async function removeUserDevice(userId: string, deviceId: string) {
  return removeDeviceFromUser(userId, deviceId)
}

/**
 * Query user's devices
 * Replaces: queryUserDeviceParams / getUserDeviceByUserIdParams
 */
export async function queryUserDevices(userId: string) {
  return UserDevices.get({userId}).go()
}

/**
 * Get users who have a specific device
 * Replaces: getUsersByDeviceId
 */
export async function getUsersByDeviceId(deviceId: string) {
  // This requires scanning with a contains filter
  // ElectroDB doesn't have native support for contains on sets, so we'll use raw DynamoDB
  // For now, return all UserDevices and filter in memory
  const allUserDevices = await UserDevices.scan.go()
  return {
    data: allUserDevices.data.filter((ud) => ud.devices && (ud.devices as string[]).includes(deviceId))
  }
}

/**
 * Delete all user's devices
 * Replaces: deleteAllUserDeviceParams
 */
export async function deleteAllUserDevices(userId: string) {
  return UserDevices.delete({userId}).go()
}

// ========================================
// Export commonly used entities for direct access
// ========================================

export {Files, Users, Devices, UserFiles, UserDevices} from '../lib/vendor/ElectroDB/service'
