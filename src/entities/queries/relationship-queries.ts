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

// Get a user-file relationship
export async function getUserFile(userId: string, fileId: string): Promise<UserFileRow | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(userFiles).where(and(eq(userFiles.userId, userId), eq(userFiles.fileId, fileId))).limit(1)
  return result.length > 0 ? result[0] : null
}

// Get all file relationships for a user
export async function getUserFilesByUserId(userId: string): Promise<UserFileRow[]> {
  const db = await getDrizzleClient()
  return await db.select().from(userFiles).where(eq(userFiles.userId, userId))
}

// Get all user relationships for a file
export async function getUserFilesByFileId(fileId: string): Promise<UserFileRow[]> {
  const db = await getDrizzleClient()
  return await db.select().from(userFiles).where(eq(userFiles.fileId, fileId))
}

// Get all files for a user with full file data (JOIN query)
export async function getFilesForUser(userId: string): Promise<FileRow[]> {
  const db = await getDrizzleClient()
  const result = await db.select({file: files}).from(userFiles).innerJoin(files, eq(userFiles.fileId, files.fileId)).where(eq(userFiles.userId, userId))
  return result.map((r) => r.file)
}

// Create a user-file relationship
export async function createUserFile(input: CreateUserFileInput): Promise<UserFileRow> {
  const db = await getDrizzleClient()
  const [userFile] = await db.insert(userFiles).values(input).returning()
  return userFile
}

// Upsert a user-file relationship (create if not exists)
export async function upsertUserFile(input: CreateUserFileInput): Promise<UserFileRow> {
  const db = await getDrizzleClient()

  const existing = await db.select().from(userFiles).where(and(eq(userFiles.userId, input.userId), eq(userFiles.fileId, input.fileId))).limit(1)

  if (existing.length > 0) {
    return existing[0]
  }

  const [created] = await db.insert(userFiles).values(input).returning()
  return created
}

// Delete a user-file relationship
export async function deleteUserFile(userId: string, fileId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(userFiles).where(and(eq(userFiles.userId, userId), eq(userFiles.fileId, fileId)))
}

// Delete all file relationships for a user
export async function deleteUserFilesByUserId(userId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(userFiles).where(eq(userFiles.userId, userId))
}

// Delete multiple user-file relationships (batch operation)
export async function deleteUserFilesBatch(keys: Array<{userId: string; fileId: string}>): Promise<void> {
  const db = await getDrizzleClient()
  for (const k of keys) {
    await db.delete(userFiles).where(and(eq(userFiles.userId, k.userId), eq(userFiles.fileId, k.fileId)))
  }
}

// UserDevice Operations

// Get a user-device relationship
export async function getUserDevice(userId: string, deviceId: string): Promise<UserDeviceRow | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(userDevices).where(and(eq(userDevices.userId, userId), eq(userDevices.deviceId, deviceId))).limit(1)
  return result.length > 0 ? result[0] : null
}

// Get all device relationships for a user
export async function getUserDevicesByUserId(userId: string): Promise<UserDeviceRow[]> {
  const db = await getDrizzleClient()
  return await db.select().from(userDevices).where(eq(userDevices.userId, userId))
}

// Get all user relationships for a device
export async function getUserDevicesByDeviceId(deviceId: string): Promise<UserDeviceRow[]> {
  const db = await getDrizzleClient()
  return await db.select().from(userDevices).where(eq(userDevices.deviceId, deviceId))
}

// Get all devices for a user with full device data (JOIN query)
export async function getDevicesForUser(userId: string): Promise<DeviceRow[]> {
  const db = await getDrizzleClient()
  const result = await db.select({device: devices}).from(userDevices).innerJoin(devices, eq(userDevices.deviceId, devices.deviceId)).where(
    eq(userDevices.userId, userId)
  )
  return result.map((r) => r.device)
}

// Get device IDs for multiple users (batch operation for push notifications)
export async function getDeviceIdsForUsers(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) {
    return []
  }
  const db = await getDrizzleClient()
  const result = await db.select({deviceId: userDevices.deviceId}).from(userDevices).where(inArray(userDevices.userId, userIds))
  return result.map((r) => r.deviceId)
}

// Create a user-device relationship
export async function createUserDevice(input: CreateUserDeviceInput): Promise<UserDeviceRow> {
  const db = await getDrizzleClient()
  const [userDevice] = await db.insert(userDevices).values(input).returning()
  return userDevice
}

// Upsert a user-device relationship (create if not exists)
export async function upsertUserDevice(input: CreateUserDeviceInput): Promise<UserDeviceRow> {
  const db = await getDrizzleClient()

  const existing = await db.select().from(userDevices).where(and(eq(userDevices.userId, input.userId), eq(userDevices.deviceId, input.deviceId))).limit(1)

  if (existing.length > 0) {
    return existing[0]
  }

  const [created] = await db.insert(userDevices).values(input).returning()
  return created
}

// Delete a user-device relationship
export async function deleteUserDevice(userId: string, deviceId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(userDevices).where(and(eq(userDevices.userId, userId), eq(userDevices.deviceId, deviceId)))
}

// Delete all device relationships for a user
export async function deleteUserDevicesByUserId(userId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(userDevices).where(eq(userDevices.userId, userId))
}

// Delete all user relationships for a device
export async function deleteUserDevicesByDeviceId(deviceId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(userDevices).where(eq(userDevices.deviceId, deviceId))
}
