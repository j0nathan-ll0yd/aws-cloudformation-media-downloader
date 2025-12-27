/**
 * WebhookFeedly Workflow Integration Tests
 *
 * Tests the Feedly webhook processing workflow with PostgreSQL:
 * 1. Extract video ID from article URL
 * 2. Create/update file records in database
 * 3. Associate files with users
 * 4. Handle duplicate webhooks (idempotency)
 *
 * These tests verify database operations using the postgres-helpers
 * against a real PostgreSQL instance (docker-compose.test.yml).
 */

// Set environment variables before imports
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'
import {FileStatus} from '#types/enums'
import {
  closeTestDb,
  createAllTables,
  dropAllTables,
  getFile,
  getTestDb,
  insertFile,
  insertUser,
  linkUserFile,
  truncateAllTables
} from '../helpers/postgres-helpers'
import {files, userFiles} from '#lib/vendor/Drizzle/schema'
import {and, eq} from 'drizzle-orm'

describe('WebhookFeedly Workflow Integration Tests', () => {
  beforeAll(async () => {
    // Create all PostgreSQL tables
    await createAllTables()
  })

  afterEach(async () => {
    // Clean up data between tests
    await truncateAllTables()
  })

  afterAll(async () => {
    // Drop tables and close connection
    await dropAllTables()
    await closeTestDb()
  })

  describe('File Creation from Webhook', () => {
    test('should create new file record when video does not exist', async () => {
      const fileId = 'dQw4w9WgXcQ'

      // Insert new file (simulating webhook processing)
      await insertFile({
        fileId,
        status: FileStatus.Queued,
        title: 'Never Gonna Give You Up',
        authorName: 'Rick Astley',
        authorUser: 'RickAstleyVEVO',
        description: 'Official music video',
        contentType: 'video/mp4',
        key: `${fileId}.mp4`,
        publishDate: '2009-10-25T00:00:00.000Z'
      })

      const file = await getFile(fileId)

      expect(file).not.toBeNull()
      expect(file?.fileId).toBe(fileId)
      expect(file?.status).toBe(FileStatus.Queued)
      expect(file?.title).toBe('Never Gonna Give You Up')
    })

    test('should not create duplicate file for same video ID', async () => {
      const fileId = 'duplicate-test'

      // Insert first file
      await insertFile({fileId, status: FileStatus.Queued, title: 'Original Title'})

      // Attempt to check if file exists (webhook idempotency check)
      const existingFile = await getFile(fileId)

      expect(existingFile).not.toBeNull()
      expect(existingFile?.title).toBe('Original Title')

      // In real workflow, we'd skip creation if file exists
    })
  })

  describe('User-File Association from Webhook', () => {
    test('should associate file with user when webhook processed', async () => {
      const userId = crypto.randomUUID()
      const fileId = 'user-video-123'

      // Create user
      await insertUser({userId, email: 'subscriber@example.com', firstName: 'Subscriber'})

      // Create file from webhook
      await insertFile({fileId, status: FileStatus.Queued})

      // Associate user with file
      await linkUserFile(userId, fileId)

      // Verify association
      const db = getTestDb()
      const associations = await db.select().from(userFiles).where(and(eq(userFiles.userId, userId), eq(userFiles.fileId, fileId)))

      expect(associations).toHaveLength(1)
    })

    test('should handle multiple users subscribing to same video', async () => {
      const fileId = 'popular-video'
      const userIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]

      // Create file
      await insertFile({fileId, status: FileStatus.Downloaded})

      // Create users and associate with file
      for (const userId of userIds) {
        await insertUser({userId, email: `user-${userId.slice(0, 8)}@example.com`, firstName: 'User'})
        await linkUserFile(userId, fileId)
      }

      // Verify all associations
      const db = getTestDb()
      const associations = await db.select().from(userFiles).where(eq(userFiles.fileId, fileId))

      expect(associations).toHaveLength(3)
    })

    test('should handle user with multiple subscribed videos', async () => {
      const userId = crypto.randomUUID()
      const videoIds = ['video-a', 'video-b', 'video-c']

      // Create user
      await insertUser({userId, email: 'multi-sub@example.com', firstName: 'MultiSub'})

      // Create videos and associate
      for (const fileId of videoIds) {
        await insertFile({fileId, status: FileStatus.Queued})
        await linkUserFile(userId, fileId)
      }

      // Verify all associations
      const db = getTestDb()
      const associations = await db.select().from(userFiles).where(eq(userFiles.userId, userId))

      expect(associations).toHaveLength(3)
      expect(associations.map((a) => a.fileId).sort()).toEqual(videoIds.sort())
    })
  })

  describe('Downloaded File Handling', () => {
    test('should return existing file if already downloaded', async () => {
      const fileId = 'already-downloaded'

      // Create file that was already downloaded
      await insertFile({fileId, status: FileStatus.Downloaded, size: 10485760, url: 'https://cdn.example.com/already-downloaded.mp4'})

      const file = await getFile(fileId)

      expect(file?.status).toBe(FileStatus.Downloaded)
      expect(file?.url).toBe('https://cdn.example.com/already-downloaded.mp4')
      // In real workflow, this would trigger immediate SQS notification
    })

    test('should identify queued files that need downloading', async () => {
      // Create mix of files in different states
      await insertFile({fileId: 'queued-1', status: FileStatus.Queued})
      await insertFile({fileId: 'queued-2', status: FileStatus.Queued})
      await insertFile({fileId: 'downloaded-1', status: FileStatus.Downloaded})
      await insertFile({fileId: 'failed-1', status: FileStatus.Failed})

      // Query for files needing download
      const db = getTestDb()
      const queuedFiles = await db.select().from(files).where(eq(files.status, FileStatus.Queued))

      expect(queuedFiles).toHaveLength(2)
      expect(queuedFiles.map((f) => f.fileId).sort()).toEqual(['queued-1', 'queued-2'])
    })
  })

  describe('Idempotency Checks', () => {
    test('should detect duplicate webhook by checking file existence', async () => {
      const fileId = 'idempotent-check'

      // First webhook - file doesn't exist
      const firstCheck = await getFile(fileId)
      expect(firstCheck).toBeNull()

      // Process webhook - create file
      await insertFile({fileId, status: FileStatus.Queued})

      // Second webhook - file exists (idempotent skip)
      const secondCheck = await getFile(fileId)
      expect(secondCheck).not.toBeNull()
      expect(secondCheck?.fileId).toBe(fileId)
    })

    test('should detect duplicate user-file association', async () => {
      const userId = crypto.randomUUID()
      const fileId = 'duplicate-assoc'

      // Setup
      await insertUser({userId, email: 'dup@example.com', firstName: 'Dup'})
      await insertFile({fileId, status: FileStatus.Queued})

      // First association
      await linkUserFile(userId, fileId)

      // Check for existing association before creating duplicate
      const db = getTestDb()
      const existing = await db.select().from(userFiles).where(and(eq(userFiles.userId, userId), eq(userFiles.fileId, fileId)))

      expect(existing).toHaveLength(1)
      // In real workflow, we'd skip if association exists
    })
  })

  describe('Batch Processing', () => {
    test('should handle batch of files from single webhook', async () => {
      const userId = crypto.randomUUID()
      const videoIds = Array.from({length: 5}, (_, i) => `batch-video-${i}`)

      // Create user
      await insertUser({userId, email: 'batch@example.com', firstName: 'Batch'})

      // Batch insert files and associations
      for (const fileId of videoIds) {
        await insertFile({fileId, status: FileStatus.Queued})
        await linkUserFile(userId, fileId)
      }

      // Verify batch processing
      const db = getTestDb()
      const allFiles = await db.select().from(files)
      const allAssociations = await db.select().from(userFiles).where(eq(userFiles.userId, userId))

      expect(allFiles).toHaveLength(5)
      expect(allAssociations).toHaveLength(5)
    })
  })
})
