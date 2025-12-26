/**
 * Files Entity - Video metadata storage.
 *
 * Stores permanent metadata about downloaded media files.
 * Status values: Queued -> Downloading -> Downloaded | Failed
 *
 * This entity provides an ElectroDB-compatible interface over Drizzle ORM
 * to minimize changes to Lambda handlers during the migration.
 *
 * Access Patterns:
 * - Primary: Get file by fileId
 * - byKey: Lookup by S3 object key (S3ObjectCreated Lambda)
 *
 * @see StartFileUpload Lambda for file creation
 * @see S3ObjectCreated Lambda for status updates
 * @see WebhookFeedly Lambda for file queuing
 */
import {eq, inArray} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {files} from '#lib/vendor/Drizzle/schema'
import type {InferInsertModel, InferSelectModel} from 'drizzle-orm'

export type FileItem = InferSelectModel<typeof files>
export type CreateFileInput = Omit<InferInsertModel<typeof files>, 'size'> & {size?: number}
export type UpdateFileInput = Partial<Omit<InferInsertModel<typeof files>, 'fileId'>>

// Overloaded get function
function filesGet(
  key: Array<{fileId: string}>
): {go: (options?: {concurrency?: number}) => Promise<{data: FileItem[]; unprocessed: Array<{fileId: string}>}>}
function filesGet(key: {fileId: string}): {go: () => Promise<{data: FileItem | null}>}
function filesGet(
  key: {fileId: string} | Array<{fileId: string}>
): {go: (options?: {concurrency?: number}) => Promise<{data: FileItem | FileItem[] | null; unprocessed?: Array<{fileId: string}>}>} {
  if (Array.isArray(key)) {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const fileIds = key.map((k) => k.fileId)
        const result = await db.select().from(files).where(inArray(files.fileId, fileIds))
        return {data: result, unprocessed: []}
      }
    }
  }
  return {
    go: async () => {
      const db = await getDrizzleClient()
      const result = await db.select().from(files).where(eq(files.fileId, key.fileId)).limit(1)
      return {data: result.length > 0 ? result[0] : null}
    }
  }
}

export const Files = {
  get: filesGet,

  create(input: CreateFileInput): {go: () => Promise<{data: FileItem}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const [file] = await db.insert(files).values({...input, size: input.size ?? 0}).returning()

        return {data: file}
      }
    }
  },

  upsert(input: CreateFileInput): {go: () => Promise<{data: FileItem}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()

        const existing = await db.select().from(files).where(eq(files.fileId, input.fileId)).limit(1)

        if (existing.length > 0) {
          const [updated] = await db.update(files).set(input).where(eq(files.fileId, input.fileId)).returning()
          return {data: updated}
        }

        const [created] = await db.insert(files).values({...input, size: input.size ?? 0}).returning()

        return {data: created}
      }
    }
  },

  update(key: {fileId: string}): {set: (data: UpdateFileInput) => {go: () => Promise<{data: FileItem}>}} {
    return {
      set: (data: UpdateFileInput) => ({
        go: async () => {
          const db = await getDrizzleClient()
          const [updated] = await db.update(files).set(data).where(eq(files.fileId, key.fileId)).returning()

          return {data: updated}
        }
      })
    }
  },

  delete(key: {fileId: string}): {go: () => Promise<Record<string, never>>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        await db.delete(files).where(eq(files.fileId, key.fileId))
        return {}
      }
    }
  },

  query: {
    byKey(key: {key: string}): {go: () => Promise<{data: FileItem[]}>} {
      return {
        go: async () => {
          const db = await getDrizzleClient()
          const result = await db.select().from(files).where(eq(files.key, key.key))
          return {data: result}
        }
      }
    }
  }
}
