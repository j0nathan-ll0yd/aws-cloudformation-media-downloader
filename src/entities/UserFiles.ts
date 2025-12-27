/**
 * UserFiles Entity - Many-to-many relationship between users and files.
 *
 * Each record represents a single user-file association.
 * Enables bidirectional queries via indexes.
 *
 * This entity provides an ElectroDB-compatible interface over Drizzle ORM
 * to minimize changes to Lambda handlers during the migration.
 *
 * Access Patterns:
 * - byUser: Query all files for a user
 * - byFile: Query all users for a file
 *
 * @see ListFiles Lambda for user file listing
 * @see S3ObjectCreated Lambda for notification fanout
 * @see UserDelete Lambda for cascade deletion
 */
import {and, eq} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {userFiles} from '#lib/vendor/Drizzle/schema'
import type {InferInsertModel, InferSelectModel} from 'drizzle-orm'

export type UserFileItem = InferSelectModel<typeof userFiles>
export type CreateUserFileInput = Omit<InferInsertModel<typeof userFiles>, 'createdAt'>
export type UpdateUserFileInput = Partial<Omit<InferInsertModel<typeof userFiles>, 'userId' | 'fileId'>>

// Overloaded delete function
function userFilesDelete(
  key: Array<{userId: string; fileId: string}>
): {go: (options?: {concurrency?: number}) => Promise<{unprocessed: Array<{userId: string; fileId: string}>}>}
function userFilesDelete(key: {userId: string; fileId: string}): {go: () => Promise<Record<string, never>>}
function userFilesDelete(key: {userId: string; fileId: string} | Array<{userId: string; fileId: string}>) {
  if (Array.isArray(key)) {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        for (const k of key) {
          await db.delete(userFiles).where(and(eq(userFiles.userId, k.userId), eq(userFiles.fileId, k.fileId)))
        }
        return {unprocessed: []}
      }
    }
  }
  return {
    go: async () => {
      const db = await getDrizzleClient()
      await db.delete(userFiles).where(and(eq(userFiles.userId, key.userId), eq(userFiles.fileId, key.fileId)))
      return {}
    }
  }
}

export const UserFiles = {
  get(key: {userId: string; fileId: string}): {go: () => Promise<{data: UserFileItem | null}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const result = await db.select().from(userFiles).where(and(eq(userFiles.userId, key.userId), eq(userFiles.fileId, key.fileId))).limit(1)
        return {data: result.length > 0 ? result[0] : null}
      }
    }
  },

  create(input: CreateUserFileInput): {go: () => Promise<{data: UserFileItem}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const [userFile] = await db.insert(userFiles).values(input).returning()
        return {data: userFile}
      }
    }
  },

  upsert(input: CreateUserFileInput): {go: () => Promise<{data: UserFileItem}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()

        const existing = await db.select().from(userFiles).where(and(eq(userFiles.userId, input.userId), eq(userFiles.fileId, input.fileId))).limit(1)

        if (existing.length > 0) {
          return {data: existing[0]}
        }

        const [created] = await db.insert(userFiles).values(input).returning()
        return {data: created}
      }
    }
  },

  delete: userFilesDelete,

  query: {
    byUser(key: {userId: string}): {go: () => Promise<{data: UserFileItem[]}>} {
      return {
        go: async () => {
          const db = await getDrizzleClient()
          const result = await db.select().from(userFiles).where(eq(userFiles.userId, key.userId))
          return {data: result}
        }
      }
    },

    byFile(key: {fileId: string}): {go: () => Promise<{data: UserFileItem[]}>} {
      return {
        go: async () => {
          const db = await getDrizzleClient()
          const result = await db.select().from(userFiles).where(eq(userFiles.fileId, key.fileId))
          return {data: result}
        }
      }
    }
  }
}
