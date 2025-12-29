/**
 * Circuit Breaker Pattern
 *
 * Lightweight implementation using in-memory state per Lambda instance.
 * Prevents cascading failures when external services (YouTube, APNS) are degraded.
 *
 * Note: State is per Lambda instance (not distributed). For distributed state,
 * consider using DynamoDB or ElastiCache. The in-memory approach works well
 * for Lambda since cold starts reset state naturally.
 *
 * @see https://martinfowler.com/bliki/CircuitBreaker.html
 * @see src/types/resilience.ts for type definitions
 */
import {logDebug, logInfo} from '#lib/system/logging'
import {metrics, MetricUnit} from '#lib/lambda/middleware/powertools'
import type {CircuitBreakerConfig, CircuitState} from '#types/resilience'

export type {CircuitBreakerConfig, CircuitState}

/**
 * Internal state tracking for circuit breaker
 */
interface CircuitBreakerState {
  state: CircuitState
  failures: number
  successes: number
  lastFailureTime: number
  lastStateChange: number
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  successThreshold: 2,
  name: 'default'
}

// In-memory state storage (per Lambda instance)
const circuitStates = new Map<string, CircuitBreakerState>()

/**
 * Get or create circuit breaker state
 */
function getState(name: string): CircuitBreakerState {
  if (!circuitStates.has(name)) {
    circuitStates.set(name, {
      state: 'CLOSED',
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      lastStateChange: Date.now()
    })
  }
  return circuitStates.get(name)!
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  public readonly retryAfterMs: number
  public readonly circuitName: string

  constructor(circuitName: string, retryAfterMs: number) {
    super(`Circuit breaker '${circuitName}' is OPEN - try again in ${Math.round(retryAfterMs / 1000)}s`)
    this.name = 'CircuitBreakerOpenError'
    this.circuitName = circuitName
    this.retryAfterMs = retryAfterMs
  }
}

/**
 * Circuit breaker for protecting against cascading failures
 *
 * Usage:
 * ```typescript
 * const youtubeBreaker = new CircuitBreaker({ name: 'youtube', failureThreshold: 3 })
 *
 * // Wrap external calls
 * const result = await youtubeBreaker.execute(() => fetchVideoInfo(videoId))
 * ```
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {...DEFAULT_CONFIG, ...config}
  }

  /**
   * Execute an operation through the circuit breaker
   *
   * @param operation - Async function to execute
   * @returns Result of the operation
   * @throws CircuitBreakerOpenError if circuit is open
   * @throws Original error if operation fails
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const state = getState(this.config.name)

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (state.state === 'OPEN') {
      const timeSinceFailure = Date.now() - state.lastFailureTime
      if (timeSinceFailure >= this.config.resetTimeout) {
        this.transitionTo(state, 'HALF_OPEN')
      } else {
        metrics.addMetric(`CircuitBreaker_${this.config.name}_Rejected`, MetricUnit.Count, 1)
        throw new CircuitBreakerOpenError(
          this.config.name,
          this.config.resetTimeout - timeSinceFailure
        )
      }
    }

    try {
      const result = await operation()
      this.onSuccess(state)
      return result
    } catch (error) {
      this.onFailure(state)
      throw error
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(state: CircuitBreakerState): void {
    if (state.state === 'HALF_OPEN') {
      state.successes++
      logDebug(`Circuit breaker ${this.config.name} success in HALF_OPEN`, {
        successes: state.successes,
        threshold: this.config.successThreshold
      })

      if (state.successes >= this.config.successThreshold) {
        this.transitionTo(state, 'CLOSED')
      }
    } else if (state.state === 'CLOSED') {
      // Reset failure count on success
      if (state.failures > 0) {
        logDebug(`Circuit breaker ${this.config.name} resetting failures`, {previousFailures: state.failures})
        state.failures = 0
      }
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(state: CircuitBreakerState): void {
    state.failures++
    state.lastFailureTime = Date.now()

    logDebug(`Circuit breaker ${this.config.name} failure`, {
      failures: state.failures,
      threshold: this.config.failureThreshold,
      state: state.state
    })

    if (state.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN reopens the circuit
      this.transitionTo(state, 'OPEN')
    } else if (state.state === 'CLOSED' && state.failures >= this.config.failureThreshold) {
      this.transitionTo(state, 'OPEN')
    }

    metrics.addMetric(`CircuitBreaker_${this.config.name}_Failure`, MetricUnit.Count, 1)
  }

  /**
   * Transition circuit to a new state
   */
  private transitionTo(state: CircuitBreakerState, newState: CircuitState): void {
    const previousState = state.state
    logInfo(`Circuit breaker ${this.config.name} state change`, {
      from: previousState,
      to: newState,
      failures: state.failures
    })

    state.state = newState
    state.lastStateChange = Date.now()

    if (newState === 'CLOSED') {
      state.failures = 0
      state.successes = 0
    } else if (newState === 'HALF_OPEN') {
      state.successes = 0
    }

    metrics.addMetric(`CircuitBreaker_${this.config.name}_StateChange`, MetricUnit.Count, 1)
  }

  /**
   * Get current circuit state (for testing/debugging)
   */
  getState(): CircuitState {
    return getState(this.config.name).state
  }

  /**
   * Get current failure count (for testing/debugging)
   */
  getFailureCount(): number {
    return getState(this.config.name).failures
  }

  /**
   * Reset circuit to closed state (for testing)
   */
  reset(): void {
    const state = getState(this.config.name)
    state.state = 'CLOSED'
    state.failures = 0
    state.successes = 0
    state.lastFailureTime = 0
    state.lastStateChange = Date.now()
    logDebug(`Circuit breaker ${this.config.name} reset`)
  }
}

/**
 * Pre-configured circuit breaker for YouTube/yt-dlp operations
 * - Higher failure threshold due to expected transient errors
 * - Longer reset timeout to avoid hammering a degraded service
 */
export const youtubeCircuitBreaker = new CircuitBreaker({
  name: 'youtube',
  failureThreshold: 3,
  resetTimeout: 5 * 60 * 1000, // 5 minutes
  successThreshold: 2
})
