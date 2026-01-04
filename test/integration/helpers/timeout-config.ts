/**
 * Environment-Aware Timeout Configuration
 *
 * Centralized timeout values that adjust automatically for CI vs local environments.
 * CI environments are typically slower due to shared resources and cold starts.
 *
 * Usage:
 * ```typescript
 * import { TIMEOUTS, POLLING } from './timeout-config'
 *
 * await waitForMessages(queueUrl, 1, TIMEOUTS.sqsMessage)
 * ```
 */

/** Detect if running in CI environment */
export const isCI = process.env.CI === 'true'

/**
 * Timeout values in milliseconds.
 * CI values are longer to account for slower, shared resources.
 */
export const TIMEOUTS = {
  // Service readiness checks
  /** Time to wait for services (LocalStack, PostgreSQL) to be ready */
  serviceReady: isCI ? 60_000 : 30_000,

  /** Time to wait for EventBridge to be operational */
  eventBridgeReady: isCI ? 45_000 : 30_000,

  // SQS message waiting
  /** Time to wait for a single SQS message */
  sqsMessage: isCI ? 15_000 : 10_000,

  /** Time to wait for multiple SQS messages */
  sqsMultipleMessages: isCI ? 25_000 : 15_000,

  // Database operations
  /** Time to wait for schema creation in globalSetup */
  schemaCreation: isCI ? 90_000 : 60_000,

  /** Time to wait for database connection */
  dbConnection: isCI ? 45_000 : 30_000,

  // EventBridge
  /** Time to wait for event to be delivered through EventBridge */
  eventDelivery: isCI ? 20_000 : 15_000,

  // SNS
  /** Time to wait for SNS operations */
  snsOperation: isCI ? 15_000 : 10_000,

  // S3
  /** Time to wait for S3 operations */
  s3Operation: isCI ? 20_000 : 15_000,

  // Test-level timeouts (for Vitest testTimeout)
  /** Default timeout for a single test */
  singleTest: isCI ? 45_000 : 30_000,

  /** Timeout for E2E tests that involve multiple services */
  e2eTest: isCI ? 90_000 : 60_000,

  /** Timeout for beforeAll/afterAll hooks */
  hookTimeout: isCI ? 90_000 : 60_000
} as const

/**
 * Polling configuration for exponential backoff.
 */
export const POLLING = {
  /** Initial delay before first retry (ms) */
  initialDelay: isCI ? 200 : 100,

  /** Maximum delay between retries (ms) */
  maxDelay: isCI ? 5_000 : 3_000,

  /** Jitter factor (0-1) to add randomness to delays */
  jitterFactor: 0.3
} as const

/**
 * Get timeout value with optional override.
 * Useful for tests that need specific timeout values.
 *
 * @param key - The timeout key from TIMEOUTS
 * @param override - Optional override value
 * @returns The timeout value in milliseconds
 */
export function getTimeout(key: keyof typeof TIMEOUTS, override?: number): number {
  return override ?? TIMEOUTS[key]
}

/**
 * Get polling configuration with optional overrides.
 *
 * @param overrides - Optional overrides for polling values
 * @returns Complete polling configuration
 */
export function getPollingConfig(overrides?: Partial<typeof POLLING>): typeof POLLING {
  return {...POLLING, ...overrides}
}

/**
 * Log timeout configuration (useful for debugging CI issues).
 * Only logs if LOG_LEVEL is not SILENT.
 */
export function logTimeoutConfig(): void {
  if (process.env.LOG_LEVEL !== 'SILENT') {
    console.log('[timeout-config] Environment:', isCI ? 'CI' : 'local')
    console.log('[timeout-config] Timeouts:', JSON.stringify(TIMEOUTS, null, 2))
    console.log('[timeout-config] Polling:', JSON.stringify(POLLING, null, 2))
  }
}
