import {logDebug, logError} from '#lib/system/logging'
import type {RetryConfig} from '#types/util'

const DEFAULT_CONFIG: Required<RetryConfig> = {maxRetries: 3, initialDelayMs: 100, multiplier: 2, maxDelayMs: 20000}

type RetryResult<T> = {data: T[]; unprocessed: unknown[]}
type DeleteResult = {unprocessed: unknown[]}
type RetryOperation<T> = () => Promise<RetryResult<T>>
type DeleteOperation = () => Promise<DeleteResult>

/**
 * Sleep for a specified duration
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate delay with exponential backoff and jitter
 * Jitter prevents thundering herd when multiple processes retry simultaneously
 * @param baseDelay - Base delay in milliseconds
 * @param retryCount - Current retry attempt (0-indexed)
 * @param multiplier - Exponential multiplier
 * @param maxDelay - Maximum delay cap
 * @returns Delay with jitter applied
 */
export function calculateDelayWithJitter(baseDelay: number, retryCount: number, multiplier: number, maxDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(multiplier, retryCount)
  const cappedDelay = Math.min(exponentialDelay, maxDelay)
  // Add 0-1000ms jitter to prevent thundering herd
  const jitter = Math.random() * 1000
  return cappedDelay + jitter
}

/**
 * Core retry logic shared between get and delete operations
 * @param operation - Async function to retry
 * @param config - Retry configuration
 * @param accumulator - Function to accumulate results across retries
 * @param operationName - Name for logging
 * @returns Final result after all retries
 */
async function retryWithBackoff<TResult extends {unprocessed: unknown[]}>(
  operation: () => Promise<TResult>,
  config: Required<RetryConfig>,
  accumulator: (prev: TResult, next: TResult) => TResult,
  operationName: string
): Promise<TResult> {
  const {maxRetries, initialDelayMs, multiplier, maxDelayMs} = config

  let result = await operation()
  let retryCount = 0

  while (result.unprocessed.length > 0 && retryCount < maxRetries) {
    logDebug(`${operationName}: ${result.unprocessed.length} unprocessed items, retry ${retryCount + 1}/${maxRetries}`)
    const delay = calculateDelayWithJitter(initialDelayMs, retryCount, multiplier, maxDelayMs)
    await sleep(delay)
    retryCount++

    try {
      const retryResult = await operation()
      result = accumulator(result, retryResult)
    } catch (error) {
      logDebug(`${operationName}: retry failed`, error as object)
    }
  }

  if (result.unprocessed.length > 0) {
    logError(`${operationName}: exhausted retries with ${result.unprocessed.length} unprocessed items remaining`)
  }

  return result
}

/**
 * Retries a batch operation that may return unprocessed items
 * Uses exponential backoff with jitter between retries
 * @param operation - Async function that returns (data, unprocessed)
 * @param config - Optional retry configuration
 * @returns Final result with any remaining unprocessed items after all retries
 */
export async function retryUnprocessed<T>(operation: RetryOperation<T>, config?: RetryConfig): Promise<RetryResult<T>> {
  const mergedConfig = {...DEFAULT_CONFIG, ...config}
  return retryWithBackoff(operation, mergedConfig, (prev, next) => ({data: [...prev.data, ...next.data], unprocessed: next.unprocessed}), 'retryUnprocessed')
}

/**
 * Retries a batch delete operation that may return unprocessed items
 * Uses exponential backoff with jitter between retries
 * @param operation - Async function that returns (unprocessed)
 * @param config - Optional retry configuration
 * @returns Final unprocessed items after all retries
 */
export async function retryUnprocessedDelete(operation: DeleteOperation, config?: RetryConfig): Promise<DeleteResult> {
  const mergedConfig = {...DEFAULT_CONFIG, ...config}
  return retryWithBackoff(operation, mergedConfig, (_prev, next) => next, 'retryUnprocessedDelete')
}
