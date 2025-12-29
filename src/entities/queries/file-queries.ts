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

// Get a file by ID
export async function getFile(fileId: string): Promise<FileRow | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(files).where(eq(files.fileId, fileId)).limit(1)
  return result.length > 0 ? result[0] : null
}

// Get multiple files by IDs (batch operation)
export async function getFilesBatch(fileIds: string[]): Promise<FileRow[]> {
  if (fileIds.length === 0) {
    return []
  }
  const db = await getDrizzleClient()
  return await db.select().from(files).where(inArray(files.fileId, fileIds))
}

// Find files by S3 object key
export async function getFilesByKey(key: string): Promise<FileRow[]> {
  const db = await getDrizzleClient()
  return await db.select().from(files).where(eq(files.key, key))
}

// Create a new file
export async function createFile(input: CreateFileInput): Promise<FileRow> {
  const db = await getDrizzleClient()
  const [file] = await db.insert(files).values({...input, size: input.size ?? 0}).returning()
  return file
}

// Upsert a file (create if not exists, update if exists)
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

// Update a file by ID
export async function updateFile(fileId: string, data: UpdateFileInput): Promise<FileRow> {
  const db = await getDrizzleClient()
  const [updated] = await db.update(files).set(data).where(eq(files.fileId, fileId)).returning()
  return updated
}

// Delete a file by ID
export async function deleteFile(fileId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(files).where(eq(files.fileId, fileId))
}

// FileDownload Operations

// Get a file download record by ID
export async function getFileDownload(fileId: string): Promise<FileDownloadRow | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(fileDownloads).where(eq(fileDownloads.fileId, fileId)).limit(1)
  return result.length > 0 ? result[0] : null
}

// Create a new file download record
export async function createFileDownload(input: CreateFileDownloadInput): Promise<FileDownloadRow> {
  const db = await getDrizzleClient()
  const [download] = await db.insert(fileDownloads).values(input).returning()
  return download
}

// Upsert a file download record
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

// Update a file download record by ID
export async function updateFileDownload(fileId: string, data: UpdateFileDownloadInput): Promise<FileDownloadRow> {
  const db = await getDrizzleClient()
  const [updated] = await db.update(fileDownloads).set({...data, updatedAt: new Date()}).where(eq(fileDownloads.fileId, fileId)).returning()
  return updated
}

// Delete a file download record by ID
export async function deleteFileDownload(fileId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(fileDownloads).where(eq(fileDownloads.fileId, fileId))
}
