/**
 * FileDownloads Entity - Download orchestration state.
 *
 * Tracks transient download state (retries, scheduling, errors).
 * Separated from Files to keep permanent metadata clean.
 *
 * This entity provides an ElectroDB-compatible interface over Drizzle ORM
 * to minimize changes to Lambda handlers during the migration.
 *
 * Note: TTL is no longer handled by DynamoDB. Completed/failed records are
 * cleaned up by the CleanupExpiredRecords scheduled Lambda.
 *
 * Access Patterns:
 * - Primary: Get download by fileId
 * - byStatusRetryAfter: Query by status and retryAfter (scheduler)
 */
import {eq} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {fileDownloads} from '#lib/vendor/Drizzle/schema'
import type {InferInsertModel, InferSelectModel} from 'drizzle-orm'

export { DownloadStatus } from '#types/enums'

export type FileDownloadItem = InferSelectModel<typeof fileDownloads>
export type CreateFileDownloadInput = Omit<InferInsertModel<typeof fileDownloads>, 'createdAt' | 'updatedAt'> & {createdAt?: number; updatedAt?: number}
export type UpdateFileDownloadInput = Partial<Omit<InferInsertModel<typeof fileDownloads>, 'fileId' | 'createdAt'>>

export const FileDownloads = {
  get(key: {fileId: string}): {go: () => Promise<{data: FileDownloadItem | null}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const result = await db.select().from(fileDownloads).where(eq(fileDownloads.fileId, key.fileId)).limit(1)
        return {data: result.length > 0 ? result[0] : null}
      }
    }
  },

  create(input: CreateFileDownloadInput): {go: () => Promise<{data: FileDownloadItem}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const now = Math.floor(Date.now() / 1000)
        const [download] = await db.insert(fileDownloads).values({...input, createdAt: input.createdAt ?? now, updatedAt: input.updatedAt ?? now})
          .returning()

        return {data: download}
      }
    }
  },

  update(key: {fileId: string}): {set: (data: UpdateFileDownloadInput) => {go: () => Promise<{data: FileDownloadItem}>}} {
    return {
      set: (data: UpdateFileDownloadInput) => ({
        go: async () => {
          const db = await getDrizzleClient()
          const now = Math.floor(Date.now() / 1000)
          const [updated] = await db.update(fileDownloads).set({...data, updatedAt: now}).where(eq(fileDownloads.fileId, key.fileId)).returning()

          return {data: updated}
        }
      })
    }
  },

  delete(key: {fileId: string}): {go: () => Promise<void>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        await db.delete(fileDownloads).where(eq(fileDownloads.fileId, key.fileId))
      }
    }
  },

  query: {
    byStatusRetryAfter(
      key: {status: string}
    ): {
      go: () => Promise<{data: FileDownloadItem[]}>
      where: (fn: (attr: {retryAfter: {lte: (val: number) => unknown}}) => unknown) => {go: () => Promise<{data: FileDownloadItem[]}>}
    } {
      return {
        go: async () => {
          const db = await getDrizzleClient()
          const result = await db.select().from(fileDownloads).where(eq(fileDownloads.status, key.status))
          return {data: result}
        },
        where: () => ({
          go: async () => {
            const db = await getDrizzleClient()
            const result = await db.select().from(fileDownloads).where(eq(fileDownloads.status, key.status))
            return {data: result}
          }
        })
      }
    }
  }
}
