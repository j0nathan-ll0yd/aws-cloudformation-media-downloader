/**
 * Query Logging Wrapper Utility
 *
 * Provides a generic wrapper for async query functions that automatically
 * logs input arguments and output results at debug level.
 *
 * Eliminates boilerplate logging patterns commonly found across Lambda handlers:
 * ```typescript
 * async function getFilesByUser(userId: string): Promise<File[]> {
 *   logDebug('getFilesByUser <=', userId)
 *   const files = await getFilesForUser(userId)
 *   logDebug('getFilesByUser =>', files)
 *   return files
 * }
 * ```
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/TypeScript/System-Library | System Library Guide}
 */
import {logDebug} from '#lib/system/logging'

/**
 * Creates a query wrapper that automatically logs input/output.
 *
 * @param fn - Async function to wrap
 * @param name - Name for logging (e.g., 'getFilesByUser')
 * @returns Wrapped function with automatic debug logging
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/TypeScript/System-Library#query-wrapper | Query Wrapper}
 */
export function withQueryLogging<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  name: string
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    // Log single arg directly for cleaner output, array for multiple args
    const logInput = args.length === 1 ? args[0] : args
    logDebug(`${name} <=`, logInput as object)

    const result = await fn(...args)

    logDebug(`${name} =>`, result as object)
    return result
  }
}

/**
 * Creates a synchronous wrapper that logs input/output.
 *
 * @param fn - Synchronous function to wrap
 * @param name - Name for logging
 * @returns Wrapped function with automatic debug logging
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/TypeScript/System-Library#query-wrapper | Query Wrapper}
 */
export function withSyncLogging<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => TResult, name: string): (...args: TArgs) => TResult {
  return (...args: TArgs): TResult => {
    const logInput = args.length === 1 ? args[0] : args
    logDebug(`${name} <=`, logInput as object)

    const result = fn(...args)

    logDebug(`${name} =>`, result as object)
    return result
  }
}
