import {describe, expect, it} from 'vitest'
import {classifyExternalApiError} from '../externalApiErrorClassifier'

describe('classifyExternalApiError', () => {
  describe('rate limiting', () => {
    it('should classify rate limit as rate_limited', () => {
      const error = new Error('Rate limit exceeded')
      const result = classifyExternalApiError(error, 'GitHub')

      expect(result.category).toBe('rate_limited')
      expect(result.retryable).toBe(true)
      expect(result.retryDelayMs).toBe(60000) // 1 minute
      expect(result.maxRetries).toBe(3)
      expect(result.createIssue).toBe(false)
    })

    it('should classify 429 as rate_limited', () => {
      const error = new Error('HTTP 429 Too Many Requests')
      const result = classifyExternalApiError(error, 'Feedly')

      expect(result.category).toBe('rate_limited')
      expect(result.retryable).toBe(true)
    })

    it('should classify too many requests as rate_limited', () => {
      const error = new Error('Too many requests')
      const result = classifyExternalApiError(error, 'API')

      expect(result.category).toBe('rate_limited')
    })

    it('should classify throttling as rate_limited', () => {
      const error = new Error('Request throttled')
      const result = classifyExternalApiError(error, 'AWS')

      expect(result.category).toBe('rate_limited')
    })

    it('should classify quota exceeded as rate_limited', () => {
      const error = new Error('API quota exceeded')
      const result = classifyExternalApiError(error, 'YouTube')

      expect(result.category).toBe('rate_limited')
    })
  })

  describe('transient server errors', () => {
    it('should classify 502 as transient', () => {
      const error = new Error('502 Bad Gateway')
      const result = classifyExternalApiError(error, 'GitHub')

      expect(result.category).toBe('transient')
      expect(result.retryable).toBe(true)
      expect(result.retryDelayMs).toBe(5000)
      expect(result.maxRetries).toBe(3)
      expect(result.createIssue).toBe(false)
    })

    it('should classify 503 as transient', () => {
      const error = new Error('503 Service Unavailable')
      const result = classifyExternalApiError(error, 'API')

      expect(result.category).toBe('transient')
      expect(result.retryable).toBe(true)
    })

    it('should classify 504 as transient', () => {
      const error = new Error('504 Gateway Timeout')
      const result = classifyExternalApiError(error, 'External')

      expect(result.category).toBe('transient')
    })

    it('should classify ECONNRESET as transient', () => {
      const error = new Error('ECONNRESET')
      const result = classifyExternalApiError(error, 'API')

      expect(result.category).toBe('transient')
      expect(result.retryable).toBe(true)
    })

    it('should classify ETIMEDOUT as transient', () => {
      const error = new Error('ETIMEDOUT')
      const result = classifyExternalApiError(error, 'API')

      expect(result.category).toBe('transient')
    })

    it('should classify network error as transient', () => {
      const error = new Error('Network error occurred')
      const result = classifyExternalApiError(error, 'API')

      expect(result.category).toBe('transient')
    })

    it('should classify socket hang up as transient', () => {
      const error = new Error('socket hang up')
      const result = classifyExternalApiError(error, 'API')

      expect(result.category).toBe('transient')
    })
  })

  describe('permanent client errors', () => {
    it('should classify 400 as permanent', () => {
      const error = new Error('400 Bad Request')
      const result = classifyExternalApiError(error, 'GitHub')

      expect(result.category).toBe('permanent')
      expect(result.retryable).toBe(false)
      expect(result.maxRetries).toBe(0)
      expect(result.createIssue).toBe(true)
      expect(result.issuePriority).toBe('normal')
    })

    it('should classify 401 as permanent', () => {
      const error = new Error('401 Unauthorized')
      const result = classifyExternalApiError(error, 'API')

      expect(result.category).toBe('permanent')
      expect(result.retryable).toBe(false)
    })

    it('should classify 403 as permanent', () => {
      const error = new Error('403 Forbidden')
      const result = classifyExternalApiError(error, 'API')

      expect(result.category).toBe('permanent')
    })

    it('should classify 404 as permanent', () => {
      const error = new Error('404 Not Found')
      const result = classifyExternalApiError(error, 'API')

      expect(result.category).toBe('permanent')
    })

    it('should classify not found as permanent', () => {
      const error = new Error('Resource not found')
      const result = classifyExternalApiError(error, 'API')

      expect(result.category).toBe('permanent')
    })

    it('should classify unauthorized as permanent', () => {
      const error = new Error('Unauthorized access')
      const result = classifyExternalApiError(error, 'API')

      expect(result.category).toBe('permanent')
    })

    it('should classify invalid request as permanent', () => {
      const error = new Error('Invalid request parameters')
      const result = classifyExternalApiError(error, 'API')

      expect(result.category).toBe('permanent')
    })
  })

  describe('unknown errors', () => {
    it('should default to permanent for unknown errors', () => {
      const error = new Error('Something unexpected happened')
      const result = classifyExternalApiError(error, 'Unknown')

      expect(result.category).toBe('permanent')
      expect(result.retryable).toBe(false)
      expect(result.maxRetries).toBe(0)
      expect(result.createIssue).toBe(true)
    })

    it('should include service name in reason', () => {
      const error = new Error('Some error')
      const result = classifyExternalApiError(error, 'MyService')

      expect(result.reason).toContain('MyService')
    })

    it('should truncate long error messages', () => {
      const longMessage = 'C'.repeat(200)
      const error = new Error(longMessage)
      const result = classifyExternalApiError(error, 'API')

      expect(result.reason.length).toBeLessThanOrEqual(150)
    })
  })
})
