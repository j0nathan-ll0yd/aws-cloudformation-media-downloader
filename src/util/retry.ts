import {logDebug} from './logging'

export interface RetryConfig {
  maxRetries?: number
  initialDelayMs?: number
  multiplier?: number
}

const DEFAULT_CONFIG: Required<RetryConfig> = {maxRetries: 3, initialDelayMs: 100, multiplier: 2}

type RetryResult<T> = {data: T[]; unprocessed: unknown[]}
type RetryOperation<T> = () => Promise<RetryResult<T>>

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retries a batch operation that may return unprocessed items
 * Uses exponential backoff between retries
 * @param operation - Async function that returns (data, unprocessed)
 * @param config - Optional retry configuration
 * @returns Final result with any remaining unprocessed items after all retries
 */
export async function retryUnprocessed<T>(operation: RetryOperation<T>, config?: RetryConfig): Promise<RetryResult<T>> {
  const {maxRetries, initialDelayMs, multiplier} = {...DEFAULT_CONFIG, ...config}

  let result = await operation()
  let retryCount = 0
  let delay = initialDelayMs

  while (result.unprocessed.length > 0 && retryCount < maxRetries) {
    logDebug(`retryUnprocessed: ${result.unprocessed.length} unprocessed items, retry ${retryCount + 1}/${maxRetries}`)
    await sleep(delay)
    delay *= multiplier
    retryCount++

    try {
      const retryResult = await operation()
      result = {data: [...result.data, ...retryResult.data], unprocessed: retryResult.unprocessed}
    } catch (error) {
      logDebug('retryUnprocessed: retry failed', error as object)
    }
  }

  if (result.unprocessed.length > 0) {
    logDebug(`retryUnprocessed: exhausted retries with ${result.unprocessed.length} unprocessed items remaining`)
  }

  return result
}

/**
 * Retries a batch delete operation that may return unprocessed items
 * @param operation - Async function that returns (unprocessed)
 * @param config - Optional retry configuration
 * @returns Final unprocessed items after all retries
 */
export async function retryUnprocessedDelete(operation: () => Promise<{unprocessed: unknown[]}>, config?: RetryConfig): Promise<{unprocessed: unknown[]}> {
  const {maxRetries, initialDelayMs, multiplier} = {...DEFAULT_CONFIG, ...config}

  let result = await operation()
  let retryCount = 0
  let delay = initialDelayMs

  while (result.unprocessed.length > 0 && retryCount < maxRetries) {
    logDebug(`retryUnprocessedDelete: ${result.unprocessed.length} unprocessed items, retry ${retryCount + 1}/${maxRetries}`)
    await sleep(delay)
    delay *= multiplier
    retryCount++

    try {
      result = await operation()
    } catch (error) {
      logDebug('retryUnprocessedDelete: retry failed', error as object)
    }
  }

  if (result.unprocessed.length > 0) {
    logDebug(`retryUnprocessedDelete: exhausted retries with ${result.unprocessed.length} unprocessed items remaining`)
  }

  return result
}
