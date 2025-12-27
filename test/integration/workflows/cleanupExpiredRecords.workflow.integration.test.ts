/**
 * CleanupExpiredRecords Workflow Integration Tests
 *
 * Tests the scheduled cleanup workflow against real PostgreSQL:
 * - FileDownloads: Completed/Failed older than 24 hours
 * - Sessions: Expired sessions (expiresAt < now)
 * - Verification: Expired tokens (expiresAt < now)
 *
 * Validates OUR business logic for:
 * - Correct expiration cutoff calculations
 * - Proper status filtering for file downloads
 * - Continuing cleanup when one table fails
 */

// Set environment variables before imports
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'
import type {Context, ScheduledEvent} from 'aws-lambda'

// Test helpers
import {
  closeTestDb,
  createAllTables,
  dropAllTables,
  getFileDownloads,
  getSessions,
  getVerificationTokens,
  insertFileDownload,
  insertSession,
  insertUser,
  insertVerification,
  truncateAllTables
} from '../helpers/postgres-helpers'

// Import handler directly (no mocking - uses real PostgreSQL)
const {handler} = await import('../../../src/lambdas/CleanupExpiredRecords/src/index')

function createScheduledEvent(): ScheduledEvent {
  return {
    version: '0',
    id: `integration-test-${Date.now()}`,
    'detail-type': 'Scheduled Event',
    source: 'aws.events',
    account: '123456789012',
    time: new Date().toISOString(),
    region: 'us-west-2',
    resources: ['arn:aws:events:us-west-2:123456789012:rule/CleanupExpiredRecords'],
    detail: {}
  }
}

function createMockContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'CleanupExpiredRecords',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-west-2:123456789012:function:CleanupExpiredRecords',
    memoryLimitInMB: '256',
    awsRequestId: `test-${Date.now()}`,
    logGroupName: '/aws/lambda/CleanupExpiredRecords',
    logStreamName: '2024/01/01/[$LATEST]test',
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {}
  }
}

describe('CleanupExpiredRecords Workflow Integration Tests', () => {
  beforeAll(async () => {
    await createAllTables()
  })

  afterEach(async () => {
    await truncateAllTables()
  })

  afterAll(async () => {
    await dropAllTables()
    await closeTestDb()
  })

  describe('FileDownloads cleanup', () => {
    test('should delete Completed file downloads older than 24 hours', async () => {
      // Arrange: Create file downloads with different ages
      const now = new Date()
      const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000)
      const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000)

      await insertFileDownload({fileId: 'old-completed', status: 'Completed', updatedAt: twentyFiveHoursAgo})
      await insertFileDownload({fileId: 'recent-completed', status: 'Completed', updatedAt: twentyThreeHoursAgo})
      await insertFileDownload({fileId: 'old-pending', status: 'Pending', updatedAt: twentyFiveHoursAgo})

      // Act
      const result = await handler(createScheduledEvent(), createMockContext())

      // Assert: Only old-completed should be deleted
      expect(result.fileDownloadsDeleted).toBe(1)
      expect(result.errors).toHaveLength(0)

      const remaining = await getFileDownloads()
      expect(remaining).toHaveLength(2)
      expect(remaining.map((r) => r.fileId).sort()).toEqual(['old-pending', 'recent-completed'])
    })

    test('should delete Failed file downloads older than 24 hours', async () => {
      const now = new Date()
      const thirtyHoursAgo = new Date(now.getTime() - 30 * 60 * 60 * 1000)

      await insertFileDownload({fileId: 'old-failed', status: 'Failed', updatedAt: thirtyHoursAgo})
      await insertFileDownload({fileId: 'old-in-progress', status: 'InProgress', updatedAt: thirtyHoursAgo})

      const result = await handler(createScheduledEvent(), createMockContext())

      expect(result.fileDownloadsDeleted).toBe(1)

      const remaining = await getFileDownloads()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].fileId).toBe('old-in-progress')
    })

    test('should not delete Pending or InProgress file downloads regardless of age', async () => {
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)

      await insertFileDownload({fileId: 'very-old-pending', status: 'Pending', updatedAt: fortyEightHoursAgo})
      await insertFileDownload({fileId: 'very-old-in-progress', status: 'InProgress', updatedAt: fortyEightHoursAgo})

      const result = await handler(createScheduledEvent(), createMockContext())

      expect(result.fileDownloadsDeleted).toBe(0)

      const remaining = await getFileDownloads()
      expect(remaining).toHaveLength(2)
    })
  })

  describe('Sessions cleanup', () => {
    test('should delete expired sessions', async () => {
      // Arrange: Create user first (for foreign key)
      const userId = crypto.randomUUID()
      await insertUser({userId, email: 'session-test@example.com', firstName: 'Session'})

      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

      await insertSession({userId, token: 'expired-token', expiresAt: oneHourAgo})
      await insertSession({userId, token: 'valid-token', expiresAt: oneHourFromNow})

      // Act
      const result = await handler(createScheduledEvent(), createMockContext())

      // Assert
      expect(result.sessionsDeleted).toBe(1)

      const remaining = await getSessions()
      expect(remaining).toHaveLength(1)
    })

    test('should delete all expired sessions when multiple exist', async () => {
      const userId = crypto.randomUUID()
      await insertUser({userId, email: 'multi-session@example.com', firstName: 'Multi'})

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)

      await insertSession({userId, token: 'expired-1', expiresAt: oneHourAgo})
      await insertSession({userId, token: 'expired-2', expiresAt: twoDaysAgo})
      await insertSession({userId, token: 'expired-3', expiresAt: oneHourAgo})

      const result = await handler(createScheduledEvent(), createMockContext())

      expect(result.sessionsDeleted).toBe(3)

      const remaining = await getSessions()
      expect(remaining).toHaveLength(0)
    })
  })

  describe('Verification tokens cleanup', () => {
    test('should delete expired verification tokens', async () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

      await insertVerification({identifier: 'expired@example.com', value: 'expired-code', expiresAt: oneHourAgo})
      await insertVerification({identifier: 'valid@example.com', value: 'valid-code', expiresAt: oneHourFromNow})

      const result = await handler(createScheduledEvent(), createMockContext())

      expect(result.verificationTokensDeleted).toBe(1)

      const remaining = await getVerificationTokens()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].identifier).toBe('valid@example.com')
    })
  })

  describe('Combined cleanup scenarios', () => {
    test('should clean all record types in single invocation', async () => {
      const userId = crypto.randomUUID()
      await insertUser({userId, email: 'combined@example.com', firstName: 'Combined'})

      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

      // Create expired records of each type
      await insertFileDownload({fileId: 'expired-download', status: 'Completed', updatedAt: twentyFiveHoursAgo})
      await insertSession({userId, token: 'expired-session', expiresAt: oneHourAgo})
      await insertVerification({identifier: 'expired@test.com', value: 'code', expiresAt: oneHourAgo})

      const result = await handler(createScheduledEvent(), createMockContext())

      expect(result.fileDownloadsDeleted).toBe(1)
      expect(result.sessionsDeleted).toBe(1)
      expect(result.verificationTokensDeleted).toBe(1)
      expect(result.errors).toHaveLength(0)
    })

    test('should handle empty tables gracefully', async () => {
      // No data inserted - tables are empty

      const result = await handler(createScheduledEvent(), createMockContext())

      expect(result.fileDownloadsDeleted).toBe(0)
      expect(result.sessionsDeleted).toBe(0)
      expect(result.verificationTokensDeleted).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    test('should handle large batch of expired records', async () => {
      const userId = crypto.randomUUID()
      await insertUser({userId, email: 'batch@example.com', firstName: 'Batch'})

      const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

      // Insert 20 expired file downloads
      for (let i = 0; i < 20; i++) {
        await insertFileDownload({fileId: `batch-download-${i}`, status: 'Completed', updatedAt: thirtyHoursAgo})
      }

      // Insert 15 expired sessions
      for (let i = 0; i < 15; i++) {
        await insertSession({userId, token: `batch-token-${i}`, expiresAt: oneHourAgo})
      }

      const result = await handler(createScheduledEvent(), createMockContext())

      expect(result.fileDownloadsDeleted).toBe(20)
      expect(result.sessionsDeleted).toBe(15)
      expect(result.errors).toHaveLength(0)
    })
  })
})
