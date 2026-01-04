/**
 * File Queries - Drizzle ORM queries for file operations.
 *
 * @see src/lib/vendor/Drizzle/schema.ts for table definitions
 */
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {fileDownloads, files} from '#lib/vendor/Drizzle/schema'
import {eq, inArray} from '#lib/vendor/Drizzle/types'
import type {InferInsertModel, InferSelectModel} from '#lib/vendor/Drizzle/types'
import {fileDownloadInsertSchema, fileDownloadUpdateSchema, fileInsertSchema, fileUpdateSchema} from '#lib/vendor/Drizzle/zodSchemas'

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
 * Gets only the status of a file (optimized - fetches single column).
 * Use when caller only needs to check file status.
 * @param fileId - The file's unique identifier
 * @returns The file status or null if not found
 */
export async function getFileStatus(fileId: string): Promise<string | null> {
  const db = await getDrizzleClient()
  const result = await db.select({status: files.status}).from(files).where(eq(files.fileId, fileId)).limit(1)
  return result.length > 0 ? result[0].status : null
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
  // Validate file input against schema
  const validatedInput = fileInsertSchema.parse({...input, size: input.size ?? 0})
  const db = await getDrizzleClient()
  const [file] = await db.insert(files).values(validatedInput).returning()
  return file
}

/**
 * Upserts a file (create if not exists, update if exists).
 * Uses atomic ON CONFLICT DO UPDATE to avoid race conditions.
 * @param input - The file data to upsert
 * @returns The created or updated file row
 */
export async function upsertFile(input: CreateFileInput): Promise<FileRow> {
  // Validate file input against schema
  const validatedInput = fileInsertSchema.parse({...input, size: input.size ?? 0})
  const db = await getDrizzleClient()
  const [result] = await db.insert(files).values(validatedInput).onConflictDoUpdate({
    target: files.fileId,
    set: {
      size: input.size ?? 0,
      authorName: input.authorName,
      authorUser: input.authorUser,
      publishDate: input.publishDate,
      description: input.description,
      key: input.key,
      url: input.url,
      contentType: input.contentType,
      title: input.title,
      status: input.status
    }
  }).returning()
  return result
}

/**
 * Updates a file by ID.
 * @param fileId - The file's unique identifier
 * @param data - The fields to update
 * @returns The updated file row
 */
export async function updateFile(fileId: string, data: UpdateFileInput): Promise<FileRow> {
  // Validate partial update data against schema
  const validatedData = fileUpdateSchema.partial().parse(data)
  const db = await getDrizzleClient()
  const [updated] = await db.update(files).set(validatedData).where(eq(files.fileId, fileId)).returning()
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
  // Validate file download input against schema
  const validatedInput = fileDownloadInsertSchema.parse(input)
  const db = await getDrizzleClient()
  const [download] = await db.insert(fileDownloads).values(validatedInput).returning()
  return download
}

/**
 * Upserts a file download record (create if not exists, update if exists).
 * Uses atomic ON CONFLICT DO UPDATE to avoid race conditions.
 * @param input - The file download data to upsert
 * @returns The created or updated file download row
 */
export async function upsertFileDownload(input: CreateFileDownloadInput): Promise<FileDownloadRow> {
  // Validate file download input against schema
  const validatedInput = fileDownloadInsertSchema.parse(input)
  const db = await getDrizzleClient()
  const [result] = await db.insert(fileDownloads).values(validatedInput).onConflictDoUpdate({
    target: fileDownloads.fileId,
    set: {
      status: input.status,
      retryCount: input.retryCount,
      maxRetries: input.maxRetries,
      retryAfter: input.retryAfter,
      errorCategory: input.errorCategory,
      lastError: input.lastError,
      scheduledReleaseTime: input.scheduledReleaseTime,
      sourceUrl: input.sourceUrl,
      correlationId: input.correlationId,
      updatedAt: new Date()
    }
  }).returning()
  return result
}

/**
 * Updates a file download record by file ID.
 * @param fileId - The file's unique identifier
 * @param data - The fields to update
 * @returns The updated file download row
 */
export async function updateFileDownload(fileId: string, data: UpdateFileDownloadInput): Promise<FileDownloadRow> {
  // Validate partial update data against schema
  const validatedData = fileDownloadUpdateSchema.partial().parse(data)
  const db = await getDrizzleClient()
  const [updated] = await db.update(fileDownloads).set({...validatedData, updatedAt: new Date()}).where(eq(fileDownloads.fileId, fileId)).returning()
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
