/**
 * File Helper Functions
 *
 * Internal utilities for file operations in StartFileUpload Lambda.
 */
import {Files} from '#entities/Files'
import {logDebug} from '#lib/system/logging'
import type {File} from '#types/domain-models'

/**
 * Upsert a File object in DynamoDB
 * @param item - The DynamoDB item to be added
 * @returns The upsert response from DynamoDB
 */
export async function upsertFile(item: File) {
  logDebug('upsertFile <=', item)
  const updateResponse = await Files.upsert(item).go()
  logDebug('upsertFile =>', updateResponse)
  return updateResponse
}
