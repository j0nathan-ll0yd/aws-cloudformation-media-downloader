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
import {DatabaseOperation} from '@mantleframework/database'
import {eq} from '@mantleframework/database/orm'
import {defineQuery} from '#db/defineQuery'
import {accounts, sessions, userDevices, userFiles, users} from '#db/schema'

/**
 * Deletes a user and ALL related records atomically.
 * Children are deleted before parent to maintain referential integrity.
 *
 * Note: This does NOT delete Devices - devices may be shared across users.
 * Use deleteUserWithDevices() if you need to delete orphaned devices.
 *
 * @param userId - The user's unique identifier
 */
export const deleteUserCascade = defineQuery({
  tables: [
    {table: userFiles, operations: [DatabaseOperation.Delete]},
    {table: userDevices, operations: [DatabaseOperation.Delete]},
    {table: sessions, operations: [DatabaseOperation.Delete]},
    {table: accounts, operations: [DatabaseOperation.Delete]},
    {table: users, operations: [DatabaseOperation.Delete]}
  ],
  transaction: true
}, async function deleteUserCascade(tx, userId: string): Promise<void> {
  // 1. Delete junction tables first (children)
  await tx.delete(userFiles).where(eq(userFiles.userId, userId))
  await tx.delete(userDevices).where(eq(userDevices.userId, userId))
  // 2. Delete auth tables
  await tx.delete(sessions).where(eq(sessions.userId, userId))
  await tx.delete(accounts).where(eq(accounts.userId, userId))
  // 3. Delete user last (parent)
  await tx.delete(users).where(eq(users.id, userId))
})

/**
 * Deletes all relationships for a user atomically.
 * Use this for partial cleanup (e.g., before re-associating).
 *
 * @param userId - The user's unique identifier
 */
export const deleteUserRelationships = defineQuery({
  tables: [
    {table: userFiles, operations: [DatabaseOperation.Delete]},
    {table: userDevices, operations: [DatabaseOperation.Delete]}
  ],
  transaction: true
}, async function deleteUserRelationships(tx, userId: string): Promise<void> {
  await tx.delete(userFiles).where(eq(userFiles.userId, userId))
  await tx.delete(userDevices).where(eq(userDevices.userId, userId))
})

/**
 * Deletes all auth records for a user atomically.
 * Use this for session invalidation (e.g., logout all devices).
 *
 * @param userId - The user's unique identifier
 */
export const deleteUserAuthRecords = defineQuery({
  tables: [
    {table: sessions, operations: [DatabaseOperation.Delete]},
    {table: accounts, operations: [DatabaseOperation.Delete]}
  ],
  transaction: true
}, async function deleteUserAuthRecords(tx, userId: string): Promise<void> {
  await tx.delete(sessions).where(eq(sessions.userId, userId))
  await tx.delete(accounts).where(eq(accounts.userId, userId))
})
