import {describe, expect, it} from 'vitest'
import {classifyDatabaseError} from '../databaseErrorClassifier'

describe('classifyDatabaseError', () => {
  describe('transient connection errors', () => {
    it('should classify connection reset as transient', () => {
      const error = new Error('Connection reset by peer')
      const result = classifyDatabaseError(error)

      expect(result.category).toBe('transient')
      expect(result.retryable).toBe(true)
      expect(result.maxRetries).toBe(3)
      expect(result.retryDelayMs).toBe(500)
    })

    it('should classify ETIMEDOUT as transient', () => {
      const error = new Error('ETIMEDOUT')
      const result = classifyDatabaseError(error)

      expect(result.category).toBe('transient')
      expect(result.retryable).toBe(true)
    })

    it('should classify too many connections as transient', () => {
      const error = new Error('Too many connections')
      const result = classifyDatabaseError(error)

      expect(result.category).toBe('transient')
      expect(result.retryable).toBe(true)
    })

    it('should classify serialization failure as transient', () => {
      const error = new Error('could not serialize access due to concurrent update')
      const result = classifyDatabaseError(error)

      expect(result.category).toBe('transient')
    })

    it('should classify 40001 error code as transient', () => {
      const error = new Error('Error 40001: serialization failure')
      const result = classifyDatabaseError(error)

      expect(result.category).toBe('transient')
      expect(result.retryable).toBe(true)
    })
  })

  describe('permanent constraint errors', () => {
    it('should classify duplicate key as permanent', () => {
      const error = new Error('Duplicate key value violates unique constraint')
      const result = classifyDatabaseError(error)

      expect(result.category).toBe('permanent')
      expect(result.retryable).toBe(false)
      expect(result.maxRetries).toBe(0)
      expect(result.createIssue).toBe(true)
      expect(result.issuePriority).toBe('high')
    })

    it('should classify foreign key constraint as permanent', () => {
      const error = new Error('Foreign key constraint violation')
      const result = classifyDatabaseError(error)

      expect(result.category).toBe('permanent')
      expect(result.createIssue).toBe(true)
    })

    it('should classify not null violation as permanent', () => {
      const error = new Error('Not null violation: column "name" cannot be null')
      const result = classifyDatabaseError(error)

      expect(result.category).toBe('permanent')
    })

    it('should classify 23505 (unique violation) as permanent', () => {
      const error = new Error('Error 23505: unique_violation')
      const result = classifyDatabaseError(error)

      expect(result.category).toBe('permanent')
    })

    it('should classify syntax error as permanent', () => {
      const error = new Error('Syntax error at or near "SELECT"')
      const result = classifyDatabaseError(error)

      expect(result.category).toBe('permanent')
      expect(result.createIssue).toBe(true)
    })

    it('should classify relation does not exist as permanent', () => {
      const error = new Error('Relation "users" does not exist')
      const result = classifyDatabaseError(error)

      expect(result.category).toBe('permanent')
    })
  })

  describe('QueryError handling', () => {
    it('should treat unknown QueryError as transient', () => {
      const error = new Error('Unknown database error')
      error.name = 'QueryError'
      const result = classifyDatabaseError(error)

      expect(result.category).toBe('transient')
      expect(result.retryable).toBe(true)
      expect(result.maxRetries).toBe(2)
    })
  })

  describe('unknown errors', () => {
    it('should default to transient for unknown errors', () => {
      const error = new Error('Something went wrong with the database')
      const result = classifyDatabaseError(error)

      expect(result.category).toBe('transient')
      expect(result.retryable).toBe(true)
      expect(result.maxRetries).toBe(2)
      expect(result.createIssue).toBe(false)
    })

    it('should truncate long error messages', () => {
      const longMessage = 'B'.repeat(200)
      const error = new Error(longMessage)
      const result = classifyDatabaseError(error)

      expect(result.reason.length).toBeLessThanOrEqual(150)
    })
  })
})
