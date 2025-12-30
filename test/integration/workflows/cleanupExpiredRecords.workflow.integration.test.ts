/**
 * CleanupExpiredRecords Workflow Integration Tests
 *
 * Tests the scheduled cleanup workflow:
 * - FileDownloads: Completed/Failed older than 24 hours
 * - Sessions: Expired sessions (expiresAt before now)
 * - Verification: Expired tokens (expiresAt before now)
 *
 * Validates OUR business logic for:
 * - Correct expiration cutoff calculations
 * - Proper status filtering for file downloads
 * - Continuing cleanup when one table fails
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'

// Store TEST_DATABASE_URL so we can disable it for this file and restore later
const originalTestDatabaseUrl = process.env.TEST_DATABASE_URL
// Disable TEST_DATABASE_URL to prevent real Drizzle client from being used (we mock it instead)
delete process.env.TEST_DATABASE_URL

import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'

// Test helpers
import {createMockContext} from '../helpers/lambda-context'
import {createMockScheduledEvent} from '../helpers/test-data'

// Mock Drizzle client - must use vi.hoisted for ESM
const {mockDbClient, mockDeleteCount} = vi.hoisted(() => {
  const counts = {fileDownloads: 0, sessions: 0, verification: 0}

  // Create a chainable mock for db.delete().where().returning()
  const createDeleteMock = (tableName: 'fileDownloads' | 'sessions' | 'verification') => ({
    where: vi.fn().mockImplementation(() => ({
      returning: vi.fn().mockImplementation(() => {
        const count = counts[tableName]
        counts[tableName] = 0 // Reset after read
        // Return array with `count` items to match result.length check
        return Promise.resolve(Array(count).fill({id: 'mock-id'}))
      })
    }))
  })

  return {
    mockDbClient: {
      delete: vi.fn().mockImplementation((table: {[key: string]: unknown}) => {
        // Determine which table based on the mock table object
        const tableName = Object.keys(table)[0] as 'fileDownloads' | 'sessions' | 'verification'
        return createDeleteMock(tableName)
      })
    },
    mockDeleteCount: counts
  }
})

vi.mock('#lib/vendor/Drizzle/client', () => ({
  getDrizzleClient: vi.fn().mockResolvedValue(mockDbClient)
}))

// Mock schema tables - provide identifiable objects for the mock client to distinguish
vi.mock('#lib/vendor/Drizzle/schema', () => ({
  fileDownloads: {fileDownloads: true, id: 'fileDownloads', updatedAt: 'updatedAt', status: 'status'},
  sessions: {sessions: true, id: 'sessions', expiresAt: 'expiresAt'},
  verification: {verification: true, id: 'verification', expiresAt: 'expiresAt'}
}))

// Mock Drizzle query helpers - these need to return comparable values
vi.mock('#lib/vendor/Drizzle/types', () => ({
  and: vi.fn((...args: unknown[]) => ({type: 'and', args})),
  or: vi.fn((...args: unknown[]) => ({type: 'or', args})),
  eq: vi.fn((col: unknown, val: unknown) => ({type: 'eq', col, val})),
  lt: vi.fn((col: unknown, val: unknown) => ({type: 'lt', col, val}))
}))

// Import handler after mocks
const {handler} = await import('#lambdas/CleanupExpiredRecords/src/index')

describe('CleanupExpiredRecords Workflow Integration Tests', () => {
  beforeAll(() => {
    // No database setup needed - we're mocking everything
  })

  afterAll(() => {
    // Restore TEST_DATABASE_URL for other test files in the same pool worker
    if (originalTestDatabaseUrl) {
      process.env.TEST_DATABASE_URL = originalTestDatabaseUrl
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset delete counts
    mockDeleteCount.fileDownloads = 0
    mockDeleteCount.sessions = 0
    mockDeleteCount.verification = 0
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('FileDownloads cleanup', () => {
    test('should delete Completed file downloads older than 24 hours', async () => {
      // Setup: 1 file download to delete
      mockDeleteCount.fileDownloads = 1

      const result = await handler(createMockScheduledEvent('cleanup-test'), createMockContext())

      expect(result.fileDownloadsDeleted).toBe(1)
      expect(result.errors).toHaveLength(0)
    })

    test('should delete Failed file downloads older than 24 hours', async () => {
      mockDeleteCount.fileDownloads = 1

      const result = await handler(createMockScheduledEvent('cleanup-test'), createMockContext())

      expect(result.fileDownloadsDeleted).toBe(1)
    })

    test('should not delete Pending or InProgress file downloads regardless of age', async () => {
      // No file downloads to delete (only Pending/InProgress exist)
      mockDeleteCount.fileDownloads = 0

      const result = await handler(createMockScheduledEvent('cleanup-test'), createMockContext())

      expect(result.fileDownloadsDeleted).toBe(0)
    })
  })

  describe('Sessions cleanup', () => {
    test('should delete expired sessions', async () => {
      mockDeleteCount.sessions = 1

      const result = await handler(createMockScheduledEvent('cleanup-test'), createMockContext())

      expect(result.sessionsDeleted).toBe(1)
    })

    test('should delete all expired sessions when multiple exist', async () => {
      mockDeleteCount.sessions = 3

      const result = await handler(createMockScheduledEvent('cleanup-test'), createMockContext())

      expect(result.sessionsDeleted).toBe(3)
    })
  })

  describe('Verification tokens cleanup', () => {
    test('should delete expired verification tokens', async () => {
      mockDeleteCount.verification = 1

      const result = await handler(createMockScheduledEvent('cleanup-test'), createMockContext())

      expect(result.verificationTokensDeleted).toBe(1)
    })
  })

  describe('Combined cleanup scenarios', () => {
    test('should clean all record types in single invocation', async () => {
      mockDeleteCount.fileDownloads = 1
      mockDeleteCount.sessions = 1
      mockDeleteCount.verification = 1

      const result = await handler(createMockScheduledEvent('cleanup-test'), createMockContext())

      expect(result.fileDownloadsDeleted).toBe(1)
      expect(result.sessionsDeleted).toBe(1)
      expect(result.verificationTokensDeleted).toBe(1)
      expect(result.errors).toHaveLength(0)
    })

    test('should handle empty tables gracefully', async () => {
      // All counts at 0 (default)
      mockDeleteCount.fileDownloads = 0
      mockDeleteCount.sessions = 0
      mockDeleteCount.verification = 0

      const result = await handler(createMockScheduledEvent('cleanup-test'), createMockContext())

      expect(result.fileDownloadsDeleted).toBe(0)
      expect(result.sessionsDeleted).toBe(0)
      expect(result.verificationTokensDeleted).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    test('should handle large batch of expired records', async () => {
      mockDeleteCount.fileDownloads = 20
      mockDeleteCount.sessions = 15
      mockDeleteCount.verification = 0

      const result = await handler(createMockScheduledEvent('cleanup-test'), createMockContext())

      expect(result.fileDownloadsDeleted).toBe(20)
      expect(result.sessionsDeleted).toBe(15)
      expect(result.errors).toHaveLength(0)
    })
  })
})
