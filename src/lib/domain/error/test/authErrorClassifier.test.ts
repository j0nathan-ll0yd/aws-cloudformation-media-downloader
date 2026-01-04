import {describe, expect, it} from 'vitest'
import {classifyAuthError} from '../authErrorClassifier'

describe('classifyAuthError', () => {
  describe('expired tokens', () => {
    it('should classify token expired as auth_expired', () => {
      const error = new Error('Token expired')
      const result = classifyAuthError(error)

      expect(result.category).toBe('auth_expired')
      expect(result.retryable).toBe(false)
      expect(result.maxRetries).toBe(0)
      expect(result.createIssue).toBe(false)
    })

    it('should classify session expired as auth_expired', () => {
      const error = new Error('Session expired')
      const result = classifyAuthError(error)

      expect(result.category).toBe('auth_expired')
      expect(result.retryable).toBe(false)
    })

    it('should classify JWT expired as auth_expired', () => {
      const error = new Error('jwt expired')
      const result = classifyAuthError(error)

      expect(result.category).toBe('auth_expired')
      expect(result.retryable).toBe(false)
    })

    it('should classify invalid_grant as auth_expired', () => {
      const error = new Error('Error: invalid_grant - token is no longer valid')
      const result = classifyAuthError(error)

      expect(result.category).toBe('auth_expired')
    })
  })

  describe('transient errors', () => {
    it('should classify network error as transient', () => {
      const error = new Error('Network error while authenticating')
      const result = classifyAuthError(error)

      expect(result.category).toBe('transient')
      expect(result.retryable).toBe(true)
      expect(result.maxRetries).toBe(3)
      expect(result.retryDelayMs).toBe(1000)
    })

    it('should classify ECONNRESET as transient', () => {
      const error = new Error('ECONNRESET')
      const result = classifyAuthError(error)

      expect(result.category).toBe('transient')
      expect(result.retryable).toBe(true)
    })

    it('should classify ETIMEDOUT as transient', () => {
      const error = new Error('ETIMEDOUT')
      const result = classifyAuthError(error)

      expect(result.category).toBe('transient')
      expect(result.retryable).toBe(true)
    })

    it('should classify 503 service unavailable as transient', () => {
      const error = new Error('503 Service Unavailable')
      const result = classifyAuthError(error)

      expect(result.category).toBe('transient')
      expect(result.retryable).toBe(true)
    })
  })

  describe('invalid credentials', () => {
    it('should classify invalid credentials as auth_invalid', () => {
      const error = new Error('Invalid credentials')
      const result = classifyAuthError(error)

      expect(result.category).toBe('auth_invalid')
      expect(result.retryable).toBe(false)
      expect(result.maxRetries).toBe(0)
      expect(result.createIssue).toBe(false)
    })

    it('should classify invalid password as auth_invalid', () => {
      const error = new Error('Invalid password')
      const result = classifyAuthError(error)

      expect(result.category).toBe('auth_invalid')
    })

    it('should classify user not found as auth_invalid', () => {
      const error = new Error('User not found')
      const result = classifyAuthError(error)

      expect(result.category).toBe('auth_invalid')
    })

    it('should classify unauthorized as auth_invalid', () => {
      const error = new Error('Unauthorized')
      const result = classifyAuthError(error)

      expect(result.category).toBe('auth_invalid')
    })
  })

  describe('unknown errors', () => {
    it('should default to auth_invalid for unknown errors', () => {
      const error = new Error('Something went wrong with authentication')
      const result = classifyAuthError(error)

      expect(result.category).toBe('auth_invalid')
      expect(result.retryable).toBe(false)
      expect(result.createIssue).toBe(false)
    })

    it('should truncate long error messages', () => {
      const longMessage = 'A'.repeat(200)
      const error = new Error(longMessage)
      const result = classifyAuthError(error)

      expect(result.reason.length).toBeLessThanOrEqual(150)
    })
  })
})
