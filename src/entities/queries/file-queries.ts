/**
 * File Queries - Native Drizzle ORM queries for file operations.
 *
 * Replaces the ElectroDB-style Files entity wrapper with direct Drizzle queries.
 *
 * @see src/lib/vendor/Drizzle/schema.ts for table definitions
 * @see src/entities/Files.ts for legacy ElectroDB wrapper (to be deprecated)
 */
import {eq, inArray} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {fileDownloads, files} from '#lib/vendor/Drizzle/schema'
import type {InferInsertModel, InferSelectModel} from 'drizzle-orm'

export type FileRow = InferSelectModel<typeof files>
export type FileDownloadRow = InferSelectModel<typeof fileDownloads>

export type CreateFileInput = Omit<InferInsertModel<typeof files>, 'size'> & {size?: number}
export type UpdateFileInput = Partial<Omit<InferInsertModel<typeof files>, 'fileId'>>

export type CreateFileDownloadInput = Omit<InferInsertModel<typeof fileDownloads>, 'createdAt' | 'updatedAt'>
export type UpdateFileDownloadInput = Partial<Omit<InferInsertModel<typeof fileDownloads>, 'fileId' | 'createdAt'>>

// File Operations

/**
 * Gets a file by ID.
 * @param fileId - The file's unique identifier
 * @returns The file row or null if not found
 */
export async function getFile(fileId: string): Promise<FileRow | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(files).where(eq(files.fileId, fileId)).limit(1)
  return result.length > 0 ? result[0] : null
}

/**
 * Gets multiple files by IDs (batch operation).
 * @param fileIds - Array of file IDs to retrieve
 * @returns Array of file rows
 */
export async function getFilesBatch(fileIds: string[]): Promise<FileRow[]> {
  if (fileIds.length === 0) {
    return []
  }
  const db = await getDrizzleClient()
  return await db.select().from(files).where(inArray(files.fileId, fileIds))
}

/**
 * Finds files by S3 object key.
 * @param key - The S3 object key to search for
 * @returns Array of files matching the key
 */
export async function getFilesByKey(key: string): Promise<FileRow[]> {
  const db = await getDrizzleClient()
  return await db.select().from(files).where(eq(files.key, key))
}

/**
 * Creates a new file.
 * @param input - The file data to create
 * @returns The created file row
 */
export async function createFile(input: CreateFileInput): Promise<FileRow> {
  const db = await getDrizzleClient()
  const [file] = await db.insert(files).values({...input, size: input.size ?? 0}).returning()
  return file
}

/**
 * Upserts a file (create if not exists, update if exists).
 * @param input - The file data to upsert
 * @returns The created or updated file row
 */
export async function upsertFile(input: CreateFileInput): Promise<FileRow> {
  const db = await getDrizzleClient()

  const existing = await db.select().from(files).where(eq(files.fileId, input.fileId)).limit(1)

  if (existing.length > 0) {
    const [updated] = await db.update(files).set(input).where(eq(files.fileId, input.fileId)).returning()
    return updated
  }

  const [created] = await db.insert(files).values({...input, size: input.size ?? 0}).returning()
  return created
}

/**
 * Updates a file by ID.
 * @param fileId - The file's unique identifier
 * @param data - The fields to update
 * @returns The updated file row
 */
export async function updateFile(fileId: string, data: UpdateFileInput): Promise<FileRow> {
  const db = await getDrizzleClient()
  const [updated] = await db.update(files).set(data).where(eq(files.fileId, fileId)).returning()
  return updated
}

/**
 * Deletes a file by ID.
 * @param fileId - The file's unique identifier
 */
export async function deleteFile(fileId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(files).where(eq(files.fileId, fileId))
}

// FileDownload Operations

/**
 * Gets a file download record by file ID.
 * @param fileId - The file's unique identifier
 * @returns The file download row or null if not found
 */
export async function getFileDownload(fileId: string): Promise<FileDownloadRow | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(fileDownloads).where(eq(fileDownloads.fileId, fileId)).limit(1)
  return result.length > 0 ? result[0] : null
}

/**
 * Creates a new file download record.
 * @param input - The file download data to create
 * @returns The created file download row
 */
export async function createFileDownload(input: CreateFileDownloadInput): Promise<FileDownloadRow> {
  const db = await getDrizzleClient()
  const [download] = await db.insert(fileDownloads).values(input).returning()
  return download
}

/**
 * Upserts a file download record (create if not exists, update if exists).
 * @param input - The file download data to upsert
 * @returns The created or updated file download row
 */
export async function upsertFileDownload(input: CreateFileDownloadInput): Promise<FileDownloadRow> {
  const db = await getDrizzleClient()

  const existing = await db.select().from(fileDownloads).where(eq(fileDownloads.fileId, input.fileId)).limit(1)

  if (existing.length > 0) {
    const [updated] = await db.update(fileDownloads).set({...input, updatedAt: new Date()}).where(eq(fileDownloads.fileId, input.fileId)).returning()
    return updated
  }

  const [created] = await db.insert(fileDownloads).values(input).returning()
  return created
}

/**
 * Updates a file download record by file ID.
 * @param fileId - The file's unique identifier
 * @param data - The fields to update
 * @returns The updated file download row
 */
export async function updateFileDownload(fileId: string, data: UpdateFileDownloadInput): Promise<FileDownloadRow> {
  const db = await getDrizzleClient()
  const [updated] = await db.update(fileDownloads).set({...data, updatedAt: new Date()}).where(eq(fileDownloads.fileId, fileId)).returning()
  return updated
}

/**
 * Deletes a file download record by file ID.
 * @param fileId - The file's unique identifier
 */
export async function deleteFileDownload(fileId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(fileDownloads).where(eq(fileDownloads.fileId, fileId))
}
