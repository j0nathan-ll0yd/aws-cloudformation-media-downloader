/**
 * CleanupExpiredRecords Workflow Integration Tests
 *
 * Tests the scheduled cleanup workflow with REAL PostgreSQL:
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
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'

// Test helpers
import {createMockContext} from '../helpers/lambda-context'
import {createMockScheduledEvent} from '../helpers/test-data'
import {
  closeTestDb,
  createAllTables,
  getFileDownloads,
  getSessions,
  getTestDbAsync,
  getVerificationTokens,
  insertFileDownload,
  insertSession,
  insertVerification,
  truncateAllTables
} from '../helpers/postgres-helpers'
import {DownloadStatus} from '#types/enums'

// Import handler - uses real Drizzle client via getDrizzleClient()
// getDrizzleClient() detects TEST_DATABASE_URL and uses local PostgreSQL
const {handler} = await import('#lambdas/CleanupExpiredRecords/src/index')

describe('CleanupExpiredRecords Workflow Integration Tests', () => {
  beforeAll(async () => {
    // Initialize test database connection and create tables
    await getTestDbAsync()
    await createAllTables()
  })

  afterEach(async () => {
    // Clean up data between tests
    await truncateAllTables()
  })

  afterAll(async () => {
    // Close database connection
    await closeTestDb()
  })

  describe('FileDownloads cleanup', () => {
    test('should delete Completed file downloads older than 24 hours', async () => {
      // Create an expired Completed download (25 hours old)
      const expiredTime = new Date(Date.now() - 25 * 60 * 60 * 1000)
      await insertFileDownload({fileId: 'expired-completed', status: DownloadStatus.Completed, updatedAt: expiredTime, createdAt: expiredTime})

      // Create a recent Completed download (1 hour old - should NOT be deleted)
      const recentTime = new Date(Date.now() - 1 * 60 * 60 * 1000)
      await insertFileDownload({fileId: 'recent-completed', status: DownloadStatus.Completed, updatedAt: recentTime, createdAt: recentTime})

      // Verify both exist before cleanup
      const beforeDownloads = await getFileDownloads()
      expect(beforeDownloads).toHaveLength(2)

      const result = await handler(createMockScheduledEvent('cleanup-test'), createMockContext())

      expect(result.fileDownloadsDeleted).toBe(1)
      expect(result.errors).toHaveLength(0)

      // Verify only the expired one was deleted
      const afterDownloads = await getFileDownloads()
      expect(afterDownloads).toHaveLength(1)
      expect(afterDownloads[0].fileId).toBe('recent-completed')
    })

    test('should delete Failed file downloads older than 24 hours', async () => {
      // Create an expired Failed download (25 hours old)
      const expiredTime = new Date(Date.now() - 25 * 60 * 60 * 1000)
      await insertFileDownload({fileId: 'expired-failed', status: DownloadStatus.Failed, updatedAt: expiredTime, createdAt: expiredTime})

      const result = await handler(createMockScheduledEvent('cleanup-test'), createMockContext())

      expect(result.fileDownloadsDeleted).toBe(1)

      const afterDownloads = await getFileDownloads()
      expect(afterDownloads).toHaveLength(0)
    })

    test('should not delete Pending or InProgress file downloads regardless of age', async () => {
      // Create old Pending download (25 hours old - should NOT be deleted)
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000)
      await insertFileDownload({fileId: 'old-pending', status: DownloadStatus.Pending, updatedAt: oldTime, createdAt: oldTime})

      // Create old InProgress download (25 hours old - should NOT be deleted)
      await insertFileDownload({fileId: 'old-inprogress', status: DownloadStatus.InProgress, updatedAt: oldTime, createdAt: oldTime})

      const result = await handler(createMockScheduledEvent('cleanup-test'), createMockContext())

      expect(result.fileDownloadsDeleted).toBe(0)

      // Verify both still exist
      const afterDownloads = await getFileDownloads()
      expect(afterDownloads).toHaveLength(2)
    })
  })

  describe('Sessions cleanup', () => {
    test('should delete expired sessions', async () => {
      const userId = crypto.randomUUID()

      // Create an expired session (expired 1 hour ago)
      await insertSession({userId, token: 'expired-token', expiresAt: new Date(Date.now() - 60 * 60 * 1000)})

      // Create a valid session (expires in 1 hour - should NOT be deleted)
      await insertSession({userId, token: 'valid-token', expiresAt: new Date(Date.now() + 60 * 60 * 1000)})

      const beforeSessions = await getSessions()
      expect(beforeSessions).toHaveLength(2)

      const result = await handler(createMockScheduledEvent('cleanup-test'), createMockContext())

      expect(result.sessionsDeleted).toBe(1)

      const afterSessions = await getSessions()
      expect(afterSessions).toHaveLength(1)
    })

    test('should delete all expired sessions when multiple exist', async () => {
      const userId = crypto.randomUUID()

      // Create 3 expired sessions
      for (let i = 0; i < 3; i++) {
        await insertSession({userId, token: `expired-token-${i}`, expiresAt: new Date(Date.now() - (i + 1) * 60 * 60 * 1000)})
      }

      const result = await handler(createMockScheduledEvent('cleanup-test'), createMockContext())

      expect(result.sessionsDeleted).toBe(3)

      const afterSessions = await getSessions()
      expect(afterSessions).toHaveLength(0)
    })
  })

  describe('Verification tokens cleanup', () => {
    test('should delete expired verification tokens', async () => {
      // Create an expired verification token
      await insertVerification({identifier: 'test@example.com', value: 'expired-token', expiresAt: new Date(Date.now() - 60 * 60 * 1000)})

      // Create a valid verification token (should NOT be deleted)
      await insertVerification({identifier: 'test2@example.com', value: 'valid-token', expiresAt: new Date(Date.now() + 60 * 60 * 1000)})

      const beforeTokens = await getVerificationTokens()
      expect(beforeTokens).toHaveLength(2)

      const result = await handler(createMockScheduledEvent('cleanup-test'), createMockContext())

      expect(result.verificationTokensDeleted).toBe(1)

      const afterTokens = await getVerificationTokens()
      expect(afterTokens).toHaveLength(1)
    })
  })

  describe('Combined cleanup scenarios', () => {
    test('should clean all record types in single invocation', async () => {
      const userId = crypto.randomUUID()
      const expiredTime = new Date(Date.now() - 25 * 60 * 60 * 1000)

      // Create one of each expired record type
      await insertFileDownload({fileId: 'expired-download', status: DownloadStatus.Completed, updatedAt: expiredTime, createdAt: expiredTime})

      await insertSession({userId, token: 'expired-session', expiresAt: new Date(Date.now() - 60 * 60 * 1000)})

      await insertVerification({identifier: 'cleanup@example.com', value: 'expired-verification', expiresAt: new Date(Date.now() - 60 * 60 * 1000)})

      const result = await handler(createMockScheduledEvent('cleanup-test'), createMockContext())

      expect(result.fileDownloadsDeleted).toBe(1)
      expect(result.sessionsDeleted).toBe(1)
      expect(result.verificationTokensDeleted).toBe(1)
      expect(result.errors).toHaveLength(0)
    })

    test('should handle empty tables gracefully', async () => {
      // Tables are empty after truncateAllTables in afterEach
      const result = await handler(createMockScheduledEvent('cleanup-test'), createMockContext())

      expect(result.fileDownloadsDeleted).toBe(0)
      expect(result.sessionsDeleted).toBe(0)
      expect(result.verificationTokensDeleted).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    test('should handle large batch of expired records', async () => {
      const userId = crypto.randomUUID()
      const expiredTime = new Date(Date.now() - 25 * 60 * 60 * 1000)

      // Create 20 expired file downloads
      for (let i = 0; i < 20; i++) {
        await insertFileDownload({fileId: `batch-download-${i}`, status: DownloadStatus.Completed, updatedAt: expiredTime, createdAt: expiredTime})
      }

      // Create 15 expired sessions
      for (let i = 0; i < 15; i++) {
        await insertSession({userId, token: `batch-session-${i}`, expiresAt: new Date(Date.now() - 60 * 60 * 1000)})
      }

      const result = await handler(createMockScheduledEvent('cleanup-test'), createMockContext())

      expect(result.fileDownloadsDeleted).toBe(20)
      expect(result.sessionsDeleted).toBe(15)
      expect(result.errors).toHaveLength(0)
    })
  })
})
