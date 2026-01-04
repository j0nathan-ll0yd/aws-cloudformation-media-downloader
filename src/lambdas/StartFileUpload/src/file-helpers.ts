/**
 * File Helper Functions
 *
 * Internal utilities for file operations in StartFileUpload Lambda.
 */
import {upsertFile as upsertFileRecord} from '#entities/queries'
import {logDebug} from '#lib/system/logging'
import type {File} from '#types/domainModels'

/**
 * Upserts a File object in the database.
 * @param item - The file data to upsert
 * @returns The created or updated file row
 */
export async function upsertFile(item: File) {
  logDebug('upsertFile <=', item)
  const result = await upsertFileRecord(item)
  logDebug('upsertFile =>', result)
  return result
}
