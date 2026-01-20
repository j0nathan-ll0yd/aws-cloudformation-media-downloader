/**
 * Cascade Operations - Transaction-wrapped multi-entity operations.
 * All operations are instrumented with withQueryMetrics for CloudWatch metrics and X-Ray tracing.
 *
 * These operations ensure atomicity when modifying related entities.
 * Aurora DSQL doesn't enforce foreign keys, so we must delete children
 * before parents to maintain referential integrity.
 *
 * Cascade order (children before parents):
 * 1. UserFiles, UserDevices (junction tables)
 * 2. Sessions, Accounts (auth tables)
 * 3. Users (parent)
 *
 * @see docs/wiki/TypeScript/Entity-Query-Patterns.md for usage examples
 * @see src/lib/vendor/Drizzle/instrumentation.ts for query metrics
 */
import {withTransaction} from '#lib/vendor/Drizzle/client'
import {withQueryMetrics} from '#lib/vendor/Drizzle/instrumentation'
import {accounts, sessions, userDevices, userFiles, users} from '#lib/vendor/Drizzle/schema'
import {eq} from '#lib/vendor/Drizzle/types'
import {DatabaseOperation, DatabaseTable, RequiresTable} from '../decorators'

/**
 * Cascade entity operations with declarative permission metadata.
 * Each method declares the database permissions it requires via decorators.
 * Permissions are extracted at build time to generate Lambda database roles.
 */
class CascadeOperations {
  /**
   * Deletes a user and ALL related records atomically.
   * Children are deleted before parent to maintain referential integrity.
   *
   * Note: This does NOT delete Devices - devices may be shared across users.
   * Use deleteUserWithDevices() if you need to delete orphaned devices.
   *
   * @param userId - The user's unique identifier
   */
  @RequiresTable([
    {table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Delete]},
    {table: DatabaseTable.UserDevices, operations: [DatabaseOperation.Delete]},
    {table: DatabaseTable.Sessions, operations: [DatabaseOperation.Delete]},
    {table: DatabaseTable.Accounts, operations: [DatabaseOperation.Delete]},
    {table: DatabaseTable.Users, operations: [DatabaseOperation.Delete]}
  ])
  static deleteUserCascade(userId: string): Promise<void> {
    return withQueryMetrics('Cascade.deleteUser', async () => {
      await withTransaction(async (tx) => {
        // 1. Delete junction tables first (children)
        await tx.delete(userFiles).where(eq(userFiles.userId, userId))
        await tx.delete(userDevices).where(eq(userDevices.userId, userId))
        // 2. Delete auth tables
        await tx.delete(sessions).where(eq(sessions.userId, userId))
        await tx.delete(accounts).where(eq(accounts.userId, userId))
        // 3. Delete user last (parent)
        await tx.delete(users).where(eq(users.id, userId))
      })
    })
  }

  /**
   * Deletes all relationships for a user atomically.
   * Use this for partial cleanup (e.g., before re-associating).
   *
   * @param userId - The user's unique identifier
   */
  @RequiresTable([
    {table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Delete]},
    {table: DatabaseTable.UserDevices, operations: [DatabaseOperation.Delete]}
  ])
  static deleteUserRelationships(userId: string): Promise<void> {
    return withQueryMetrics('Cascade.deleteUserRelationships', async () => {
      await withTransaction(async (tx) => {
        await tx.delete(userFiles).where(eq(userFiles.userId, userId))
        await tx.delete(userDevices).where(eq(userDevices.userId, userId))
      })
    })
  }

  /**
   * Deletes all auth records for a user atomically.
   * Use this for session invalidation (e.g., logout all devices).
   *
   * @param userId - The user's unique identifier
   */
  @RequiresTable([
    {table: DatabaseTable.Sessions, operations: [DatabaseOperation.Delete]},
    {table: DatabaseTable.Accounts, operations: [DatabaseOperation.Delete]}
  ])
  static deleteUserAuthRecords(userId: string): Promise<void> {
    return withQueryMetrics('Cascade.deleteUserAuthRecords', async () => {
      await withTransaction(async (tx) => {
        await tx.delete(sessions).where(eq(sessions.userId, userId))
        await tx.delete(accounts).where(eq(accounts.userId, userId))
      })
    })
  }
}

// Re-export static methods as named exports for backwards compatibility
export const deleteUserCascade = CascadeOperations.deleteUserCascade.bind(CascadeOperations)
export const deleteUserRelationships = CascadeOperations.deleteUserRelationships.bind(CascadeOperations)
export const deleteUserAuthRecords = CascadeOperations.deleteUserAuthRecords.bind(CascadeOperations)

// Export class for extraction script access
export { CascadeOperations }
