/**
 * Resilience Pattern Types
 *
 * Type definitions for resilience patterns used throughout the application,
 * including circuit breakers, retry configurations, and failure handling.
 *
 * @see src/lib/system/circuit-breaker.ts for circuit breaker implementation
 * @see src/lib/system/retry.ts for retry utilities
 */

/**
 * Circuit breaker states
 *
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Failures exceeded threshold, requests rejected immediately
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

/**
 * Configuration options for the circuit breaker
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold: number
  /** Time in ms to wait before attempting recovery (default: 60000) */
  resetTimeout: number
  /** Number of successful calls in HALF_OPEN to close circuit (default: 2) */
  successThreshold: number
  /** Name for logging and metrics */
  name: string
}

/**
 * Result of cleaning up a disabled APNS endpoint
 */
export interface EndpointCleanupResult {
  /** The device ID that was cleaned up */
  deviceId: string
  /** The SNS endpoint ARN that was cleaned up */
  endpointArn: string
  /** Whether the cleanup was successful */
  cleaned: boolean
  /** Error message if cleanup failed */
  error?: string
}
