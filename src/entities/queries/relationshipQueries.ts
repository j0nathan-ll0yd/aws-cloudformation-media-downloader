/**
 * Relationship Queries - Drizzle ORM queries for user-file and user-device relationships.
 * All queries are instrumented with withQueryMetrics for CloudWatch metrics and X-Ray tracing.
 *
 * @see src/lib/vendor/Drizzle/schema.ts for table definitions
 * @see src/lib/vendor/Drizzle/instrumentation.ts for query metrics
 */
import {getDrizzleClient, withTransaction} from '#lib/vendor/Drizzle/client'
import {assertDeviceExists, assertFileExists, assertUserExists} from '#lib/vendor/Drizzle/fkEnforcement'
import {withQueryMetrics} from '#lib/vendor/Drizzle/instrumentation'
import {devices, files, userDevices, userFiles} from '#lib/vendor/Drizzle/schema'
import {and, eq, inArray, or} from '#lib/vendor/Drizzle/types'
import type {InferInsertModel, InferSelectModel} from '#lib/vendor/Drizzle/types'
import {userDeviceInsertSchema, userFileInsertSchema} from '#lib/vendor/Drizzle/zodSchemas'
import {DatabaseOperation, DatabaseTable, RequiresTable} from '../decorators'
import type {DeviceRow} from './deviceQueries'
import type {FileRow} from './fileQueries'

export type UserFileRow = InferSelectModel<typeof userFiles>
export type UserDeviceRow = InferSelectModel<typeof userDevices>

export type CreateUserFileInput = Omit<InferInsertModel<typeof userFiles>, 'createdAt'>
export type CreateUserDeviceInput = Omit<InferInsertModel<typeof userDevices>, 'createdAt'>

/**
 * Relationship entity query operations with declarative permission metadata.
 * Each method declares the database permissions it requires via decorators.
 * Permissions are extracted at build time to generate Lambda database roles.
 */
class RelationshipQueries {
  // UserFile Operations

  /**
   * Gets a user-file relationship.
   * @param userId - The user's unique identifier
   * @param fileId - The file's unique identifier
   * @returns The user-file row or null if not found
   */
  @RequiresTable([{table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Select]}])
  static getUserFile(userId: string, fileId: string): Promise<UserFileRow | null> {
    return withQueryMetrics('UserFiles.get', async () => {
      const db = await getDrizzleClient()
      const result = await db.select().from(userFiles).where(and(eq(userFiles.userId, userId), eq(userFiles.fileId, fileId))).limit(1)
      return result.length > 0 ? result[0] : null
    })
  }

  /**
   * Gets all file relationships for a user.
   * @param userId - The user's unique identifier
   * @returns Array of user-file rows
   */
  @RequiresTable([{table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Select]}])
  static getUserFilesByUserId(userId: string): Promise<UserFileRow[]> {
    return withQueryMetrics('UserFiles.getByUserId', async () => {
      const db = await getDrizzleClient()
      return await db.select().from(userFiles).where(eq(userFiles.userId, userId))
    })
  }

  /**
   * Gets file IDs for a user (optimized - fetches only IDs).
   * Use when caller only needs file IDs, not full relationship data.
   * @param userId - The user's unique identifier
   * @returns Array of file IDs
   */
  @RequiresTable([{table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Select]}])
  static getUserFileIdsByUserId(userId: string): Promise<string[]> {
    return withQueryMetrics('UserFiles.getIdsByUserId', async () => {
      const db = await getDrizzleClient()
      const result = await db.select({fileId: userFiles.fileId}).from(userFiles).where(eq(userFiles.userId, userId))
      return result.map((r) => r.fileId)
    })
  }

  /**
   * Gets all user relationships for a file.
   * @param fileId - The file's unique identifier
   * @returns Array of user-file rows
   */
  @RequiresTable([{table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Select]}])
  static getUserFilesByFileId(fileId: string): Promise<UserFileRow[]> {
    return withQueryMetrics('UserFiles.getByFileId', async () => {
      const db = await getDrizzleClient()
      return await db.select().from(userFiles).where(eq(userFiles.fileId, fileId))
    })
  }

  /**
   * Gets all files for a user with full file data (JOIN query).
   * @param userId - The user's unique identifier
   * @returns Array of file rows
   */
  @RequiresTable([
    {table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Select]},
    {table: DatabaseTable.Files, operations: [DatabaseOperation.Select]}
  ])
  static getFilesForUser(userId: string): Promise<FileRow[]> {
    return withQueryMetrics('UserFiles.getFilesForUser', async () => {
      const db = await getDrizzleClient()
      const result = await db.select({file: files}).from(userFiles).innerJoin(files, eq(userFiles.fileId, files.fileId)).where(eq(userFiles.userId, userId))
      return result.map((r) => r.file)
    })
  }

  /**
   * Creates a user-file relationship.
   * Validates that both user and file exist before creating (application-level FK enforcement).
   * @param input - The user-file data to create
   * @returns The created user-file row
   * @throws ForeignKeyViolationError if user or file does not exist
   */
  @RequiresTable([
    {table: DatabaseTable.Users, operations: [DatabaseOperation.Select]},
    {table: DatabaseTable.Files, operations: [DatabaseOperation.Select]},
    {table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Insert]}
  ])
  static createUserFile(input: CreateUserFileInput): Promise<UserFileRow> {
    return withQueryMetrics('UserFiles.create', async () => {
      const validatedInput = userFileInsertSchema.parse(input)
      return await withTransaction(async (tx) => {
        // Validate FK references exist (Aurora DSQL doesn't enforce FKs)
        await assertUserExists(validatedInput.userId)
        await assertFileExists(validatedInput.fileId)
        const [userFile] = await tx.insert(userFiles).values(validatedInput).returning()
        return userFile
      })
    })
  }

  /**
   * Upserts a user-file relationship (create if not exists).
   * Uses atomic ON CONFLICT DO NOTHING to avoid race conditions.
   *
   * Note: Unlike createUserFile(), this does NOT validate FK references.
   * Upserts are typically used in contexts where parent entities have already been created.
   *
   * @param input - The user-file data to upsert
   * @returns The existing or created user-file row
   */
  @RequiresTable([
    {table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Insert, DatabaseOperation.Select]}
  ])
  static upsertUserFile(input: CreateUserFileInput): Promise<UserFileRow> {
    return withQueryMetrics('UserFiles.upsert', async () => {
      const validatedInput = userFileInsertSchema.parse(input)
      const db = await getDrizzleClient()
      // Try to insert, do nothing on conflict (junction table has no updatable fields)
      const result = await db.insert(userFiles).values(validatedInput).onConflictDoNothing({target: [userFiles.userId, userFiles.fileId]}).returning()
      // If conflict occurred (no rows returned), fetch existing record
      if (result.length === 0) {
        const [existing] = await db.select().from(userFiles).where(and(eq(userFiles.userId, input.userId), eq(userFiles.fileId, input.fileId))).limit(1)
        return existing
      }
      return result[0]
    })
  }

  /**
   * Deletes a user-file relationship.
   * @param userId - The user's unique identifier
   * @param fileId - The file's unique identifier
   */
  @RequiresTable([{table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Delete]}])
  static deleteUserFile(userId: string, fileId: string): Promise<void> {
    return withQueryMetrics('UserFiles.delete', async () => {
      const db = await getDrizzleClient()
      await db.delete(userFiles).where(and(eq(userFiles.userId, userId), eq(userFiles.fileId, fileId)))
    })
  }

  /**
   * Deletes all file relationships for a user.
   * @param userId - The user's unique identifier
   */
  @RequiresTable([{table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Delete]}])
  static deleteUserFilesByUserId(userId: string): Promise<void> {
    return withQueryMetrics('UserFiles.deleteByUserId', async () => {
      const db = await getDrizzleClient()
      await db.delete(userFiles).where(eq(userFiles.userId, userId))
    })
  }

  /**
   * Deletes multiple user-file relationships (batch operation).
   * Uses single query with OR conditions instead of N separate queries.
   * @param keys - Array of userId/fileId pairs to delete
   */
  @RequiresTable([{table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Delete]}])
  static deleteUserFilesBatch(keys: Array<{userId: string; fileId: string}>): Promise<void> {
    return withQueryMetrics('UserFiles.deleteBatch', async () => {
      if (keys.length === 0) {
        return
      }

      const db = await getDrizzleClient()

      // Build OR conditions for composite key matching
      const conditions = keys.map((k) => and(eq(userFiles.userId, k.userId), eq(userFiles.fileId, k.fileId)))

      await db.delete(userFiles).where(or(...conditions))
    })
  }

  // UserDevice Operations

  /**
   * Gets a user-device relationship.
   * @param userId - The user's unique identifier
   * @param deviceId - The device's unique identifier
   * @returns The user-device row or null if not found
   */
  @RequiresTable([{table: DatabaseTable.UserDevices, operations: [DatabaseOperation.Select]}])
  static getUserDevice(userId: string, deviceId: string): Promise<UserDeviceRow | null> {
    return withQueryMetrics('UserDevices.get', async () => {
      const db = await getDrizzleClient()
      const result = await db.select().from(userDevices).where(and(eq(userDevices.userId, userId), eq(userDevices.deviceId, deviceId))).limit(1)
      return result.length > 0 ? result[0] : null
    })
  }

  /**
   * Gets all device relationships for a user.
   * @param userId - The user's unique identifier
   * @returns Array of user-device rows
   */
  @RequiresTable([{table: DatabaseTable.UserDevices, operations: [DatabaseOperation.Select]}])
  static getUserDevicesByUserId(userId: string): Promise<UserDeviceRow[]> {
    return withQueryMetrics('UserDevices.getByUserId', async () => {
      const db = await getDrizzleClient()
      return await db.select().from(userDevices).where(eq(userDevices.userId, userId))
    })
  }

  /**
   * Gets device IDs for a user (optimized - fetches only IDs).
   * Use when caller only needs device IDs, not full relationship data.
   * @param userId - The user's unique identifier
   * @returns Array of device IDs
   */
  @RequiresTable([{table: DatabaseTable.UserDevices, operations: [DatabaseOperation.Select]}])
  static getUserDeviceIdsByUserId(userId: string): Promise<string[]> {
    return withQueryMetrics('UserDevices.getIdsByUserId', async () => {
      const db = await getDrizzleClient()
      const result = await db.select({deviceId: userDevices.deviceId}).from(userDevices).where(eq(userDevices.userId, userId))
      return result.map((r) => r.deviceId)
    })
  }

  /**
   * Gets all user relationships for a device.
   * @param deviceId - The device's unique identifier
   * @returns Array of user-device rows
   */
  @RequiresTable([{table: DatabaseTable.UserDevices, operations: [DatabaseOperation.Select]}])
  static getUserDevicesByDeviceId(deviceId: string): Promise<UserDeviceRow[]> {
    return withQueryMetrics('UserDevices.getByDeviceId', async () => {
      const db = await getDrizzleClient()
      return await db.select().from(userDevices).where(eq(userDevices.deviceId, deviceId))
    })
  }

  /**
   * Gets all devices for a user with full device data (JOIN query).
   * @param userId - The user's unique identifier
   * @returns Array of device rows
   */
  @RequiresTable([
    {table: DatabaseTable.UserDevices, operations: [DatabaseOperation.Select]},
    {table: DatabaseTable.Devices, operations: [DatabaseOperation.Select]}
  ])
  static getDevicesForUser(userId: string): Promise<DeviceRow[]> {
    return withQueryMetrics('UserDevices.getDevicesForUser', async () => {
      const db = await getDrizzleClient()
      const result = await db.select({device: devices}).from(userDevices).innerJoin(devices, eq(userDevices.deviceId, devices.deviceId)).where(
        eq(userDevices.userId, userId)
      )
      return result.map((r) => r.device)
    })
  }

  /**
   * Gets device IDs for multiple users (batch operation for push notifications).
   * @param userIds - Array of user IDs
   * @returns Array of device IDs
   */
  @RequiresTable([{table: DatabaseTable.UserDevices, operations: [DatabaseOperation.Select]}])
  static getDeviceIdsForUsers(userIds: string[]): Promise<string[]> {
    return withQueryMetrics('UserDevices.getIdsForUsers', async () => {
      if (userIds.length === 0) {
        return []
      }
      const db = await getDrizzleClient()
      const result = await db.select({deviceId: userDevices.deviceId}).from(userDevices).where(inArray(userDevices.userId, userIds))
      return result.map((r) => r.deviceId)
    })
  }

  /**
   * Creates a user-device relationship.
   * Validates that both user and device exist before creating (application-level FK enforcement).
   * @param input - The user-device data to create
   * @returns The created user-device row
   * @throws ForeignKeyViolationError if user or device does not exist
   */
  @RequiresTable([
    {table: DatabaseTable.Users, operations: [DatabaseOperation.Select]},
    {table: DatabaseTable.Devices, operations: [DatabaseOperation.Select]},
    {table: DatabaseTable.UserDevices, operations: [DatabaseOperation.Insert]}
  ])
  static createUserDevice(input: CreateUserDeviceInput): Promise<UserDeviceRow> {
    return withQueryMetrics('UserDevices.create', async () => {
      const validatedInput = userDeviceInsertSchema.parse(input)
      return await withTransaction(async (tx) => {
        // Validate FK references exist (Aurora DSQL doesn't enforce FKs)
        await assertUserExists(validatedInput.userId)
        await assertDeviceExists(validatedInput.deviceId)
        const [userDevice] = await tx.insert(userDevices).values(validatedInput).returning()
        return userDevice
      })
    })
  }

  /**
   * Upserts a user-device relationship (create if not exists).
   * Uses atomic ON CONFLICT DO NOTHING to avoid race conditions.
   *
   * Note: Unlike createUserDevice(), this does NOT validate FK references.
   * Upserts are typically used in contexts where parent entities have already been created.
   *
   * @param input - The user-device data to upsert
   * @returns The existing or created user-device row
   */
  @RequiresTable([
    {table: DatabaseTable.UserDevices, operations: [DatabaseOperation.Insert, DatabaseOperation.Select]}
  ])
  static upsertUserDevice(input: CreateUserDeviceInput): Promise<UserDeviceRow> {
    return withQueryMetrics('UserDevices.upsert', async () => {
      const validatedInput = userDeviceInsertSchema.parse(input)
      const db = await getDrizzleClient()
      // Try to insert, do nothing on conflict (junction table has no updatable fields)
      const result = await db.insert(userDevices).values(validatedInput).onConflictDoNothing({target: [userDevices.userId, userDevices.deviceId]})
        .returning()
      // If conflict occurred (no rows returned), fetch existing record
      if (result.length === 0) {
        const [existing] = await db.select().from(userDevices).where(and(eq(userDevices.userId, input.userId), eq(userDevices.deviceId, input.deviceId)))
          .limit(1)
        return existing
      }
      return result[0]
    })
  }

  /**
   * Deletes a user-device relationship.
   * @param userId - The user's unique identifier
   * @param deviceId - The device's unique identifier
   */
  @RequiresTable([{table: DatabaseTable.UserDevices, operations: [DatabaseOperation.Delete]}])
  static deleteUserDevice(userId: string, deviceId: string): Promise<void> {
    return withQueryMetrics('UserDevices.delete', async () => {
      const db = await getDrizzleClient()
      await db.delete(userDevices).where(and(eq(userDevices.userId, userId), eq(userDevices.deviceId, deviceId)))
    })
  }

  /**
   * Deletes all device relationships for a user.
   * @param userId - The user's unique identifier
   */
  @RequiresTable([{table: DatabaseTable.UserDevices, operations: [DatabaseOperation.Delete]}])
  static deleteUserDevicesByUserId(userId: string): Promise<void> {
    return withQueryMetrics('UserDevices.deleteByUserId', async () => {
      const db = await getDrizzleClient()
      await db.delete(userDevices).where(eq(userDevices.userId, userId))
    })
  }

  /**
   * Deletes all user relationships for a device.
   * @param deviceId - The device's unique identifier
   */
  @RequiresTable([{table: DatabaseTable.UserDevices, operations: [DatabaseOperation.Delete]}])
  static deleteUserDevicesByDeviceId(deviceId: string): Promise<void> {
    return withQueryMetrics('UserDevices.deleteByDeviceId', async () => {
      const db = await getDrizzleClient()
      await db.delete(userDevices).where(eq(userDevices.deviceId, deviceId))
    })
  }
}

// Re-export static methods as named exports for backwards compatibility
export const getUserFile = RelationshipQueries.getUserFile.bind(RelationshipQueries)
export const getUserFilesByUserId = RelationshipQueries.getUserFilesByUserId.bind(RelationshipQueries)
export const getUserFileIdsByUserId = RelationshipQueries.getUserFileIdsByUserId.bind(RelationshipQueries)
export const getUserFilesByFileId = RelationshipQueries.getUserFilesByFileId.bind(RelationshipQueries)
export const getFilesForUser = RelationshipQueries.getFilesForUser.bind(RelationshipQueries)
export const createUserFile = RelationshipQueries.createUserFile.bind(RelationshipQueries)
export const upsertUserFile = RelationshipQueries.upsertUserFile.bind(RelationshipQueries)
export const deleteUserFile = RelationshipQueries.deleteUserFile.bind(RelationshipQueries)
export const deleteUserFilesByUserId = RelationshipQueries.deleteUserFilesByUserId.bind(RelationshipQueries)
export const deleteUserFilesBatch = RelationshipQueries.deleteUserFilesBatch.bind(RelationshipQueries)
export const getUserDevice = RelationshipQueries.getUserDevice.bind(RelationshipQueries)
export const getUserDevicesByUserId = RelationshipQueries.getUserDevicesByUserId.bind(RelationshipQueries)
export const getUserDeviceIdsByUserId = RelationshipQueries.getUserDeviceIdsByUserId.bind(RelationshipQueries)
export const getUserDevicesByDeviceId = RelationshipQueries.getUserDevicesByDeviceId.bind(RelationshipQueries)
export const getDevicesForUser = RelationshipQueries.getDevicesForUser.bind(RelationshipQueries)
export const getDeviceIdsForUsers = RelationshipQueries.getDeviceIdsForUsers.bind(RelationshipQueries)
export const createUserDevice = RelationshipQueries.createUserDevice.bind(RelationshipQueries)
export const upsertUserDevice = RelationshipQueries.upsertUserDevice.bind(RelationshipQueries)
export const deleteUserDevice = RelationshipQueries.deleteUserDevice.bind(RelationshipQueries)
export const deleteUserDevicesByUserId = RelationshipQueries.deleteUserDevicesByUserId.bind(RelationshipQueries)
export const deleteUserDevicesByDeviceId = RelationshipQueries.deleteUserDevicesByDeviceId.bind(RelationshipQueries)

// Export class for extraction script access
export { RelationshipQueries }
