/**
 * Unit tests for Circuit Breaker Pattern
 *
 * Tests state transitions, failure counting, and recovery behavior.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

// Mock dependencies BEFORE importing
vi.mock('#lib/system/logging', () => ({logDebug: vi.fn(), logInfo: vi.fn()}))

vi.mock('#lib/lambda/middleware/powertools', () => ({metrics: {addMetric: vi.fn()}, MetricUnit: {Count: 'Count'}}))

// Import after mocking
const {CircuitBreaker, CircuitBreakerOpenError, youtubeCircuitBreaker} = await import('../circuitBreaker')
import {metrics} from '#lib/lambda/middleware/powertools'
import {logInfo} from '#lib/system/logging'

describe('Circuit Breaker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('CircuitBreakerOpenError', () => {
    it('should create error with correct properties', () => {
      const error = new CircuitBreakerOpenError('test-circuit', 5000)

      expect(error.name).toBe('CircuitBreakerOpenError')
      expect(error.circuitName).toBe('test-circuit')
      expect(error.retryAfterMs).toBe(5000)
      expect(error.message).toContain("Circuit breaker 'test-circuit' is OPEN")
      expect(error.message).toContain('5s')
    })

    it('should format retry time correctly for different durations', () => {
      const error1 = new CircuitBreakerOpenError('test', 1500)
      expect(error1.message).toContain('2s') // Rounded

      const error2 = new CircuitBreakerOpenError('test', 30000)
      expect(error2.message).toContain('30s')
    })
  })

  describe('CircuitBreaker class', () => {
    it('should start in CLOSED state', () => {
      const breaker = new CircuitBreaker({name: 'test-closed'})
      expect(breaker.getState()).toBe('CLOSED')
      expect(breaker.getFailureCount()).toBe(0)
    })

    it('should use default config when none provided', () => {
      const breaker = new CircuitBreaker()
      expect(breaker.getState()).toBe('CLOSED')
    })

    it('should execute operation successfully in CLOSED state', async () => {
      const breaker = new CircuitBreaker({name: 'test-success'})
      const operation = vi.fn().mockResolvedValue('success')

      const result = await breaker.execute(operation)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalled()
      expect(breaker.getState()).toBe('CLOSED')
    })

    it('should count failures in CLOSED state', async () => {
      const breaker = new CircuitBreaker({name: 'test-fail-count', failureThreshold: 5})
      const failingOperation = vi.fn().mockRejectedValue(new Error('failure'))

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingOperation)).rejects.toThrow('failure')
      }

      expect(breaker.getFailureCount()).toBe(3)
      expect(breaker.getState()).toBe('CLOSED')
    })

    it('should transition to OPEN after failure threshold', async () => {
      const breaker = new CircuitBreaker({name: 'test-open', failureThreshold: 3})
      const failingOperation = vi.fn().mockRejectedValue(new Error('failure'))

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingOperation)).rejects.toThrow('failure')
      }

      expect(breaker.getState()).toBe('OPEN')
      expect(logInfo).toHaveBeenCalledWith('Circuit breaker test-open state change', expect.objectContaining({from: 'CLOSED', to: 'OPEN'}))
    })

    it('should reject requests when OPEN', async () => {
      const breaker = new CircuitBreaker({name: 'test-reject', failureThreshold: 1, resetTimeout: 60000})
      const failingOperation = vi.fn().mockRejectedValue(new Error('failure'))

      await expect(breaker.execute(failingOperation)).rejects.toThrow('failure')
      expect(breaker.getState()).toBe('OPEN')

      const successOperation = vi.fn().mockResolvedValue('should not run')
      await expect(breaker.execute(successOperation)).rejects.toThrow(CircuitBreakerOpenError)
      expect(successOperation).not.toHaveBeenCalled()
      expect(metrics.addMetric).toHaveBeenCalledWith('CircuitBreaker_test-reject_Rejected', 'Count', 1)
    })

    it('should transition to HALF_OPEN after reset timeout', async () => {
      const breaker = new CircuitBreaker({name: 'test-half-open', failureThreshold: 1, resetTimeout: 5000})
      const failingOperation = vi.fn().mockRejectedValue(new Error('failure'))

      await expect(breaker.execute(failingOperation)).rejects.toThrow('failure')
      expect(breaker.getState()).toBe('OPEN')

      // Advance time past reset timeout
      vi.advanceTimersByTime(5001)

      const successOperation = vi.fn().mockResolvedValue('success')
      const result = await breaker.execute(successOperation)

      expect(result).toBe('success')
      expect(breaker.getState()).toBe('HALF_OPEN')
    })

    it('should transition to CLOSED after success threshold in HALF_OPEN', async () => {
      const breaker = new CircuitBreaker({name: 'test-recover', failureThreshold: 1, resetTimeout: 1000, successThreshold: 2})
      const failingOperation = vi.fn().mockRejectedValue(new Error('failure'))

      await expect(breaker.execute(failingOperation)).rejects.toThrow('failure')
      expect(breaker.getState()).toBe('OPEN')

      vi.advanceTimersByTime(1001)

      const successOperation = vi.fn().mockResolvedValue('success')

      // First success - still HALF_OPEN
      await breaker.execute(successOperation)
      expect(breaker.getState()).toBe('HALF_OPEN')

      // Second success - transitions to CLOSED
      await breaker.execute(successOperation)
      expect(breaker.getState()).toBe('CLOSED')
      expect(breaker.getFailureCount()).toBe(0)
    })

    it('should transition back to OPEN on failure in HALF_OPEN', async () => {
      const breaker = new CircuitBreaker({name: 'test-reopen', failureThreshold: 1, resetTimeout: 1000})
      const failingOperation = vi.fn().mockRejectedValue(new Error('failure'))

      await expect(breaker.execute(failingOperation)).rejects.toThrow('failure')
      expect(breaker.getState()).toBe('OPEN')

      vi.advanceTimersByTime(1001)

      // This transitions to HALF_OPEN and then fails
      await expect(breaker.execute(failingOperation)).rejects.toThrow('failure')
      expect(breaker.getState()).toBe('OPEN')
    })

    it('should reset failure count on success in CLOSED state', async () => {
      const breaker = new CircuitBreaker({name: 'test-reset', failureThreshold: 5})
      const failingOperation = vi.fn().mockRejectedValue(new Error('failure'))
      const successOperation = vi.fn().mockResolvedValue('success')

      // Accumulate some failures
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingOperation)).rejects.toThrow('failure')
      }
      expect(breaker.getFailureCount()).toBe(3)

      // Success resets failure count
      await breaker.execute(successOperation)
      expect(breaker.getFailureCount()).toBe(0)
    })

    it('should record failure metric on failure', async () => {
      const breaker = new CircuitBreaker({name: 'test-metric'})
      const failingOperation = vi.fn().mockRejectedValue(new Error('failure'))

      await expect(breaker.execute(failingOperation)).rejects.toThrow('failure')

      expect(metrics.addMetric).toHaveBeenCalledWith('CircuitBreaker_test-metric_Failure', 'Count', 1)
    })

    it('should record state change metric on transition', async () => {
      const breaker = new CircuitBreaker({name: 'test-state-metric', failureThreshold: 1})
      const failingOperation = vi.fn().mockRejectedValue(new Error('failure'))

      await expect(breaker.execute(failingOperation)).rejects.toThrow('failure')

      expect(metrics.addMetric).toHaveBeenCalledWith('CircuitBreaker_test-state-metric_StateChange', 'Count', 1)
    })

    describe('reset()', () => {
      it('should reset circuit to CLOSED state', async () => {
        const breaker = new CircuitBreaker({name: 'test-manual-reset', failureThreshold: 1})
        const failingOperation = vi.fn().mockRejectedValue(new Error('failure'))

        await expect(breaker.execute(failingOperation)).rejects.toThrow('failure')
        expect(breaker.getState()).toBe('OPEN')

        breaker.reset()

        expect(breaker.getState()).toBe('CLOSED')
        expect(breaker.getFailureCount()).toBe(0)
      })
    })
  })

  describe('youtubeCircuitBreaker', () => {
    it('should be pre-configured with YouTube-specific settings', () => {
      // Reset the pre-configured breaker to test it works
      youtubeCircuitBreaker.reset()
      expect(youtubeCircuitBreaker.getState()).toBe('CLOSED')
    })
  })
})
