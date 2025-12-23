import {logDebug} from '#lib/system/logging'

/**
 * Scans all pages of a DynamoDB table using ElectroDB pagination
 * Handles the cursor-based pagination automatically
 * @param scanFn - Function that performs a scan with optional cursor
 * @returns All items from all pages combined
 */
export async function scanAllPages<T>(scanFn: (cursor?: string) => Promise<{data: T[]; cursor: string | null}>): Promise<T[]> {
  const allItems: T[] = []
  let cursor: string | undefined

  do {
    logDebug('scanAllPages: fetching page', cursor ? {cursor} : 'initial')
    const result = await scanFn(cursor)
    allItems.push(...result.data)
    cursor = result.cursor ?? undefined
    logDebug('scanAllPages: received items', {count: result.data.length, hasMore: !!cursor})
  } while (cursor)

  logDebug('scanAllPages: complete', {totalItems: allItems.length})
  return allItems
}
