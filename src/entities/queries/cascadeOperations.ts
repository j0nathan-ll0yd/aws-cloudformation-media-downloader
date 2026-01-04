/**
 * Cascade Operations - Transaction-wrapped multi-entity operations.
 *
 * These operations ensure atomicity when modifying related entities.
 * Aurora DSQL doesn't enforce foreign keys, so we must delete children
 * before parents to maintain referential integrity.
 *
 * Cascade order (children before parents):
 * 1. UserFiles, UserDevices (junction tables)
 * 2. Sessions, Accounts (auth tables)
 * 3. IdentityProviders (1:1 with user)
 * 4. Users (parent)
 *
 * @see docs/wiki/TypeScript/Entity-Query-Patterns.md for usage examples
 */
import {withTransaction} from '#lib/vendor/Drizzle/client'
import {accounts, identityProviders, sessions, userDevices, userFiles, users} from '#lib/vendor/Drizzle/schema'
import {eq} from '#lib/vendor/Drizzle/types'

/**
 * Deletes a user and ALL related records atomically.
 * Children are deleted before parent to maintain referential integrity.
 *
 * Note: This does NOT delete Devices - devices may be shared across users.
 * Use deleteUserWithDevices() if you need to delete orphaned devices.
 *
 * @param userId - The user's unique identifier
 */
export async function deleteUserCascade(userId: string): Promise<void> {
  await withTransaction(async (tx) => {
    // 1. Delete junction tables first (children)
    await tx.delete(userFiles).where(eq(userFiles.userId, userId))
    await tx.delete(userDevices).where(eq(userDevices.userId, userId))
    // 2. Delete auth tables
    await tx.delete(sessions).where(eq(sessions.userId, userId))
    await tx.delete(accounts).where(eq(accounts.userId, userId))
    // 3. Delete identity provider (1:1 with user)
    await tx.delete(identityProviders).where(eq(identityProviders.userId, userId))
    // 4. Delete user last (parent)
    await tx.delete(users).where(eq(users.id, userId))
  })
}

/**
 * Deletes all relationships for a user atomically.
 * Use this for partial cleanup (e.g., before re-associating).
 *
 * @param userId - The user's unique identifier
 */
export async function deleteUserRelationships(userId: string): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.delete(userFiles).where(eq(userFiles.userId, userId))
    await tx.delete(userDevices).where(eq(userDevices.userId, userId))
  })
}

/**
 * Deletes all auth records for a user atomically.
 * Use this for session invalidation (e.g., logout all devices).
 *
 * @param userId - The user's unique identifier
 */
export async function deleteUserAuthRecords(userId: string): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.userId, userId))
    await tx.delete(accounts).where(eq(accounts.userId, userId))
  })
}
