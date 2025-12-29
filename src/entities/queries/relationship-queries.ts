/**
 * Relationship Queries - Native Drizzle ORM queries for user-file and user-device relationships.
 *
 * Replaces the ElectroDB-style UserFiles and UserDevices entity wrappers with direct Drizzle queries.
 *
 * @see src/lib/vendor/Drizzle/schema.ts for table definitions
 * @see src/entities/UserFiles.ts for legacy ElectroDB wrapper (to be deprecated)
 * @see src/entities/UserDevices.ts for legacy ElectroDB wrapper (to be deprecated)
 */
import {and, eq, inArray} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {devices, files, userDevices, userFiles} from '#lib/vendor/Drizzle/schema'
import type {InferInsertModel, InferSelectModel} from 'drizzle-orm'
import type {FileRow} from './file-queries'
import type {DeviceRow} from './device-queries'

export type UserFileRow = InferSelectModel<typeof userFiles>
export type UserDeviceRow = InferSelectModel<typeof userDevices>

export type CreateUserFileInput = Omit<InferInsertModel<typeof userFiles>, 'createdAt'>
export type CreateUserDeviceInput = Omit<InferInsertModel<typeof userDevices>, 'createdAt'>

// UserFile Operations

/**
 * Gets a user-file relationship.
 * @param userId - The user's unique identifier
 * @param fileId - The file's unique identifier
 * @returns The user-file row or null if not found
 */
export async function getUserFile(userId: string, fileId: string): Promise<UserFileRow | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(userFiles).where(and(eq(userFiles.userId, userId), eq(userFiles.fileId, fileId))).limit(1)
  return result.length > 0 ? result[0] : null
}

/**
 * Gets all file relationships for a user.
 * @param userId - The user's unique identifier
 * @returns Array of user-file rows
 */
export async function getUserFilesByUserId(userId: string): Promise<UserFileRow[]> {
  const db = await getDrizzleClient()
  return await db.select().from(userFiles).where(eq(userFiles.userId, userId))
}

/**
 * Gets all user relationships for a file.
 * @param fileId - The file's unique identifier
 * @returns Array of user-file rows
 */
export async function getUserFilesByFileId(fileId: string): Promise<UserFileRow[]> {
  const db = await getDrizzleClient()
  return await db.select().from(userFiles).where(eq(userFiles.fileId, fileId))
}

/**
 * Gets all files for a user with full file data (JOIN query).
 * @param userId - The user's unique identifier
 * @returns Array of file rows
 */
export async function getFilesForUser(userId: string): Promise<FileRow[]> {
  const db = await getDrizzleClient()
  const result = await db.select({file: files}).from(userFiles).innerJoin(files, eq(userFiles.fileId, files.fileId)).where(eq(userFiles.userId, userId))
  return result.map((r) => r.file)
}

/**
 * Creates a user-file relationship.
 * @param input - The user-file data to create
 * @returns The created user-file row
 */
export async function createUserFile(input: CreateUserFileInput): Promise<UserFileRow> {
  const db = await getDrizzleClient()
  const [userFile] = await db.insert(userFiles).values(input).returning()
  return userFile
}

/**
 * Upserts a user-file relationship (create if not exists).
 * @param input - The user-file data to upsert
 * @returns The existing or created user-file row
 */
export async function upsertUserFile(input: CreateUserFileInput): Promise<UserFileRow> {
  const db = await getDrizzleClient()

  const existing = await db.select().from(userFiles).where(and(eq(userFiles.userId, input.userId), eq(userFiles.fileId, input.fileId))).limit(1)

  if (existing.length > 0) {
    return existing[0]
  }

  const [created] = await db.insert(userFiles).values(input).returning()
  return created
}

/**
 * Deletes a user-file relationship.
 * @param userId - The user's unique identifier
 * @param fileId - The file's unique identifier
 */
export async function deleteUserFile(userId: string, fileId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(userFiles).where(and(eq(userFiles.userId, userId), eq(userFiles.fileId, fileId)))
}

/**
 * Deletes all file relationships for a user.
 * @param userId - The user's unique identifier
 */
export async function deleteUserFilesByUserId(userId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(userFiles).where(eq(userFiles.userId, userId))
}

/**
 * Deletes multiple user-file relationships (batch operation).
 * @param keys - Array of userId/fileId pairs to delete
 */
export async function deleteUserFilesBatch(keys: Array<{userId: string; fileId: string}>): Promise<void> {
  const db = await getDrizzleClient()
  for (const k of keys) {
    await db.delete(userFiles).where(and(eq(userFiles.userId, k.userId), eq(userFiles.fileId, k.fileId)))
  }
}

// UserDevice Operations

/**
 * Gets a user-device relationship.
 * @param userId - The user's unique identifier
 * @param deviceId - The device's unique identifier
 * @returns The user-device row or null if not found
 */
export async function getUserDevice(userId: string, deviceId: string): Promise<UserDeviceRow | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(userDevices).where(and(eq(userDevices.userId, userId), eq(userDevices.deviceId, deviceId))).limit(1)
  return result.length > 0 ? result[0] : null
}

/**
 * Gets all device relationships for a user.
 * @param userId - The user's unique identifier
 * @returns Array of user-device rows
 */
export async function getUserDevicesByUserId(userId: string): Promise<UserDeviceRow[]> {
  const db = await getDrizzleClient()
  return await db.select().from(userDevices).where(eq(userDevices.userId, userId))
}

/**
 * Gets all user relationships for a device.
 * @param deviceId - The device's unique identifier
 * @returns Array of user-device rows
 */
export async function getUserDevicesByDeviceId(deviceId: string): Promise<UserDeviceRow[]> {
  const db = await getDrizzleClient()
  return await db.select().from(userDevices).where(eq(userDevices.deviceId, deviceId))
}

/**
 * Gets all devices for a user with full device data (JOIN query).
 * @param userId - The user's unique identifier
 * @returns Array of device rows
 */
export async function getDevicesForUser(userId: string): Promise<DeviceRow[]> {
  const db = await getDrizzleClient()
  const result = await db.select({device: devices}).from(userDevices).innerJoin(devices, eq(userDevices.deviceId, devices.deviceId)).where(
    eq(userDevices.userId, userId)
  )
  return result.map((r) => r.device)
}

/**
 * Gets device IDs for multiple users (batch operation for push notifications).
 * @param userIds - Array of user IDs
 * @returns Array of device IDs
 */
export async function getDeviceIdsForUsers(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) {
    return []
  }
  const db = await getDrizzleClient()
  const result = await db.select({deviceId: userDevices.deviceId}).from(userDevices).where(inArray(userDevices.userId, userIds))
  return result.map((r) => r.deviceId)
}

/**
 * Creates a user-device relationship.
 * @param input - The user-device data to create
 * @returns The created user-device row
 */
export async function createUserDevice(input: CreateUserDeviceInput): Promise<UserDeviceRow> {
  const db = await getDrizzleClient()
  const [userDevice] = await db.insert(userDevices).values(input).returning()
  return userDevice
}

/**
 * Upserts a user-device relationship (create if not exists).
 * @param input - The user-device data to upsert
 * @returns The existing or created user-device row
 */
export async function upsertUserDevice(input: CreateUserDeviceInput): Promise<UserDeviceRow> {
  const db = await getDrizzleClient()

  const existing = await db.select().from(userDevices).where(and(eq(userDevices.userId, input.userId), eq(userDevices.deviceId, input.deviceId))).limit(1)

  if (existing.length > 0) {
    return existing[0]
  }

  const [created] = await db.insert(userDevices).values(input).returning()
  return created
}

/**
 * Deletes a user-device relationship.
 * @param userId - The user's unique identifier
 * @param deviceId - The device's unique identifier
 */
export async function deleteUserDevice(userId: string, deviceId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(userDevices).where(and(eq(userDevices.userId, userId), eq(userDevices.deviceId, deviceId)))
}

/**
 * Deletes all device relationships for a user.
 * @param userId - The user's unique identifier
 */
export async function deleteUserDevicesByUserId(userId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(userDevices).where(eq(userDevices.userId, userId))
}

/**
 * Deletes all user relationships for a device.
 * @param deviceId - The device's unique identifier
 */
export async function deleteUserDevicesByDeviceId(deviceId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(userDevices).where(eq(userDevices.deviceId, deviceId))
}
