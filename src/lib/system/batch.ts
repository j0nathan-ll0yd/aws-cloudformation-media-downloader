/**
 * Batch Processing Utilities
 *
 * Provides helpers for working with Promise.allSettled results,
 * commonly used in Lambda handlers that process multiple items.
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/TypeScript/System-Library | System Library Guide}
 */
import type {BatchResultCounts, SeparatedBatchResults} from '#types/util'

export type { BatchResultCounts, SeparatedBatchResults }

/**
 * Separates Promise.allSettled results into succeeded values and failed errors.
 *
 * @param results - Array of PromiseSettledResult from Promise.allSettled
 * @returns Object with succeeded values and failed errors
 *
 * @example
 * ```typescript
 * const {succeeded, failed} = separateBatchResults(results)
 * ```
 */
export function separateBatchResults<T>(results: PromiseSettledResult<T>[]): SeparatedBatchResults<T> {
  const succeeded: T[] = []
  const failed: Error[] = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      succeeded.push(result.value)
    } else {
      // Ensure we always have an Error object
      const error = result.reason instanceof Error ? result.reason : new Error(String(result.reason))
      failed.push(error)
    }
  }

  return {succeeded, failed}
}

/**
 * Counts success and failure from Promise.allSettled results.
 *
 * @param results - Array of PromiseSettledResult from Promise.allSettled
 * @returns Object with successCount and failureCount
 *
 * @example
 * ```typescript
 * const {successCount, failureCount} = countBatchResults(results)
 * ```
 */
export function countBatchResults(results: PromiseSettledResult<unknown>[]): BatchResultCounts {
  const successCount = results.filter((r) => r.status === 'fulfilled').length
  return {successCount, failureCount: results.length - successCount}
}

/**
 * Extracts all error messages from failed Promise.allSettled results.
 *
 * @param results - Array of PromiseSettledResult from Promise.allSettled
 * @returns Array of error messages from rejected promises
 *
 * @example
 * ```typescript
 * const errors = getFailureMessages(results)
 * ```
 */
export function getFailureMessages(results: PromiseSettledResult<unknown>[]): string[] {
  return results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map((
    r
  ) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
}

/**
 * Checks if all promises in a batch succeeded.
 *
 * @param results - Array of PromiseSettledResult from Promise.allSettled
 * @returns true if all promises were fulfilled
 */
export function allSucceeded(results: PromiseSettledResult<unknown>[]): boolean {
  return results.every((r) => r.status === 'fulfilled')
}

/**
 * Checks if any promises in a batch failed.
 *
 * @param results - Array of PromiseSettledResult from Promise.allSettled
 * @returns true if at least one promise was rejected
 */
export function anyFailed(results: PromiseSettledResult<unknown>[]): boolean {
  return results.some((r) => r.status === 'rejected')
}
