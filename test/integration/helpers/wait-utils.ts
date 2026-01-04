/**
 * Wait Utilities with Exponential Backoff
 *
 * Provides reusable async waiting functions with exponential backoff and jitter
 * to reduce race conditions in integration tests.
 *
 * These utilities replace fixed polling intervals throughout the test suite
 * for more resilient async waiting.
 */

/**
 * Configuration options for the waitFor function.
 */
export interface WaitOptions {
  /** Initial delay between retries in milliseconds (default: 100) */
  initialDelayMs?: number
  /** Maximum delay between retries in milliseconds (default: 5000) */
  maxDelayMs?: number
  /** Maximum total time to wait in milliseconds (default: 30000) */
  maxTotalMs?: number
  /** Jitter factor (0-1) to add randomness to delays (default: 0.3) */
  jitterFactor?: number
  /** Optional description for error messages */
  description?: string
}

/**
 * Result from the waitFor function.
 */
export interface WaitResult<T> {
  /** The value returned by the condition function */
  value: T
  /** Number of attempts before success */
  attempts: number
  /** Total time waited in milliseconds */
  elapsedMs: number
}

/**
 * Waits for a condition to be met with exponential backoff.
 *
 * The condition function should return a truthy value when the condition is met,
 * or null/undefined to continue waiting. The function will throw after the timeout.
 *
 * @param condition - Async function that returns the expected value or null to continue waiting
 * @param options - Configuration for delays, timeouts, and jitter
 * @returns Promise resolving to the condition result and metadata
 * @throws Error if the condition is not met within the timeout
 *
 * @example
 * ```typescript
 * // Wait for a message to arrive
 * const result = await waitFor(
 *   async () => {
 *     const messages = await receiveMessages(queueUrl)
 *     return messages.length > 0 ? messages : null
 *   },
 *   { maxTotalMs: 10000, description: 'SQS message' }
 * )
 * ```
 */
export async function waitFor<T>(condition: () => Promise<T | null | undefined>, options: WaitOptions = {}): Promise<WaitResult<T>> {
  const {initialDelayMs = 100, maxDelayMs = 5000, maxTotalMs = 30000, jitterFactor = 0.3, description = 'condition'} = options

  const startTime = Date.now()
  let attempt = 0
  let delay = initialDelayMs

  while (Date.now() - startTime < maxTotalMs) {
    attempt++

    const result = await condition()
    if (result !== null && result !== undefined) {
      return {value: result, attempts: attempt, elapsedMs: Date.now() - startTime}
    }

    // Calculate next delay with exponential backoff and jitter
    const jitter = jitterFactor > 0 ? Math.random() * jitterFactor * delay : 0
    const nextDelay = Math.min(delay + jitter, maxDelayMs)

    // Check if we have time for another attempt
    const elapsed = Date.now() - startTime
    const remainingTime = maxTotalMs - elapsed
    if (remainingTime <= nextDelay) {
      // Not enough time for another attempt after sleeping
      break
    }

    await sleep(nextDelay)

    // Exponential increase for next iteration
    delay = Math.min(delay * 2, maxDelayMs)
  }

  const elapsed = Date.now() - startTime
  throw new Error(`Timeout waiting for ${description} after ${elapsed}ms (${attempt} attempts)`)
}

/**
 * Waits for a count-based condition to be met (e.g., waiting for N messages).
 *
 * @param countFn - Async function that returns the current count
 * @param expectedCount - The count to wait for
 * @param options - Configuration for delays and timeouts
 * @returns Promise resolving when the expected count is reached
 */
export async function waitForCount(countFn: () => Promise<number>, expectedCount: number, options: WaitOptions = {}): Promise<WaitResult<number>> {
  return waitFor(async () => {
    const count = await countFn()
    return count >= expectedCount ? count : null
  }, {...options, description: options.description || `count >= ${expectedCount}`})
}

/**
 * Waits for an array to have at least the expected number of items.
 *
 * @param arrayFn - Async function that returns an array
 * @param expectedLength - Minimum array length to wait for
 * @param options - Configuration for delays and timeouts
 * @returns Promise resolving to the array when it has enough items
 */
export async function waitForArray<T>(arrayFn: () => Promise<T[]>, expectedLength: number, options: WaitOptions = {}): Promise<WaitResult<T[]>> {
  return waitFor(async () => {
    const arr = await arrayFn()
    return arr.length >= expectedLength ? arr : null
  }, {...options, description: options.description || `array.length >= ${expectedLength}`})
}

/**
 * Calculate exponential backoff delay with jitter.
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param initialDelay - Initial delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @param jitterFactor - Jitter factor (0-1)
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attempt: number, initialDelay: number, maxDelay: number, jitterFactor = 0.3): number {
  const exponentialDelay = initialDelay * Math.pow(2, attempt)
  const jitter = jitterFactor > 0 ? Math.random() * jitterFactor * exponentialDelay : 0
  return Math.min(exponentialDelay + jitter, maxDelay)
}

/**
 * Sleep for a specified duration.
 *
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff.
 *
 * Unlike waitFor, this retries on errors rather than null returns.
 *
 * @param fn - Async function to retry
 * @param options - Configuration for delays and timeouts
 * @returns Promise resolving to the function result
 * @throws The last error if all retries fail
 */
export async function retryWithBackoff<T>(fn: () => Promise<T>, options: WaitOptions = {}): Promise<WaitResult<T>> {
  const {initialDelayMs = 100, maxDelayMs = 5000, maxTotalMs = 30000, jitterFactor = 0.3, description = 'operation'} = options

  const startTime = Date.now()
  let attempt = 0
  let delay = initialDelayMs
  let lastError: Error | undefined

  while (Date.now() - startTime < maxTotalMs) {
    attempt++

    try {
      const result = await fn()
      return {value: result, attempts: attempt, elapsedMs: Date.now() - startTime}
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Calculate next delay
      const jitter = jitterFactor > 0 ? Math.random() * jitterFactor * delay : 0
      const nextDelay = Math.min(delay + jitter, maxDelayMs)

      // Check if we have time for another attempt
      const elapsed = Date.now() - startTime
      const remainingTime = maxTotalMs - elapsed
      if (remainingTime <= nextDelay) {
        break
      }

      await sleep(nextDelay)
      delay = Math.min(delay * 2, maxDelayMs)
    }
  }

  const elapsed = Date.now() - startTime
  throw new Error(`${description} failed after ${elapsed}ms (${attempt} attempts): ${lastError?.message}`)
}
