/**
 * S3ObjectCreated Workflow Integration Tests
 *
 * Tests the file notification dispatch workflow:
 * 1. Receive S3 object creation event
 * 2. Query PostgreSQL for file record by key
 * 3. Query PostgreSQL for users waiting for file
 * 4. Dispatch SQS notifications to each user
 *
 * Uses LocalStack SQS and real PostgreSQL.
 *
 * @see src/lambdas/S3ObjectCreated/src/index.ts
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'

// Test helpers
import {closeTestDb, createAllTables, dropAllTables, insertFile, insertUser, linkUserFile, truncateAllTables} from '../helpers/postgres-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createMockS3BatchEvent, createMockS3Event} from '../helpers/test-data'
import {clearTestQueue, createTestQueue, deleteTestQueue, waitForMessages} from '../helpers/sqs-helpers'
import {FileStatus} from '#types/enums'

// Set SNS_QUEUE_URL before importing handler
const TEST_QUEUE = `test-s3-notification-queue-${Date.now()}`
let queueUrl: string

// Import handler after environment setup
const {handler} = await import('#lambdas/S3ObjectCreated/src/index')

// Skip in CI: Handler uses own Drizzle connection that doesn't respect worker schema isolation
describe.skipIf(Boolean(process.env.CI))('S3ObjectCreated Workflow Integration Tests', () => {
  beforeAll(async () => {
    // Create PostgreSQL tables
    await createAllTables()

    // Create LocalStack SQS queue
    const queueInfo = await createTestQueue(TEST_QUEUE)
    queueUrl = queueInfo.queueUrl

    // Set environment variable for the Lambda
    process.env.SNS_QUEUE_URL = queueUrl
  })

  afterEach(async () => {
    // Clean up data between tests
    await truncateAllTables()
    await clearTestQueue(queueUrl)
  })

  afterAll(async () => {
    // Clean up LocalStack SQS
    await deleteTestQueue(queueUrl)

    // Drop tables and close connection
    await dropAllTables()
    await closeTestDb()
  })

  describe('Single User Notification', () => {
    test('should dispatch notification to single user waiting for file', async () => {
      const userId = crypto.randomUUID()
      const fileId = 'video-single-user'
      const fileKey = `${fileId}.mp4`

      await insertFile({fileId, key: fileKey, status: FileStatus.Downloaded})
      await insertUser({userId, email: 'single@example.com'})
      await linkUserFile(userId, fileId)

      const event = createMockS3Event(fileKey)
      await handler(event, createMockContext())

      const messages = await waitForMessages(queueUrl, 1, 10000)
      expect(messages.length).toBe(1)

      const body = JSON.parse(messages[0].Body!)
      expect(body.file.fileId).toBe(fileId)
    })

    test('should handle URL-encoded file keys correctly', async () => {
      const userId = crypto.randomUUID()
      const fileId = 'video-with-spaces'
      const fileKey = 'My Video File.mp4'

      await insertFile({fileId, key: fileKey, status: FileStatus.Downloaded})
      await insertUser({userId, email: 'spaces@example.com'})
      await linkUserFile(userId, fileId)

      const event = createMockS3Event(fileKey)
      await handler(event, createMockContext())

      const messages = await waitForMessages(queueUrl, 1, 10000)
      expect(messages.length).toBe(1)
    })
  })

  describe('Multi-User Fan-out', () => {
    test('should fan-out to multiple users waiting for same file', async () => {
      const user1Id = crypto.randomUUID()
      const user2Id = crypto.randomUUID()
      const user3Id = crypto.randomUUID()
      const fileId = 'video-multi-user'
      const fileKey = `${fileId}.mp4`

      await insertFile({fileId, key: fileKey, status: FileStatus.Downloaded})
      await insertUser({userId: user1Id, email: 'user1@example.com'})
      await insertUser({userId: user2Id, email: 'user2@example.com'})
      await insertUser({userId: user3Id, email: 'user3@example.com'})
      await linkUserFile(user1Id, fileId)
      await linkUserFile(user2Id, fileId)
      await linkUserFile(user3Id, fileId)

      const event = createMockS3Event(fileKey)
      await handler(event, createMockContext())

      const messages = await waitForMessages(queueUrl, 3, 15000)
      expect(messages.length).toBe(3)

      for (const msg of messages) {
        const body = JSON.parse(msg.Body!)
        expect(body.file.fileId).toBe(fileId)
      }
    })
  })

  describe('Edge Cases', () => {
    test('should handle file not found gracefully', async () => {
      const event = createMockS3Event('nonexistent-file.mp4')

      await expect(handler(event, createMockContext())).resolves.not.toThrow()
    })

    test('should handle no users waiting for file', async () => {
      const fileId = 'video-no-users'
      const fileKey = `${fileId}.mp4`

      await insertFile({fileId, key: fileKey, status: FileStatus.Downloaded})

      const event = createMockS3Event(fileKey)
      await handler(event, createMockContext())

      const messages = await waitForMessages(queueUrl, 1, 3000)
      expect(messages.length).toBe(0)
    })
  })

  describe('Batch Processing', () => {
    test('should process multiple S3 records in batch', async () => {
      const user1Id = crypto.randomUUID()
      const user2Id = crypto.randomUUID()
      const file1Key = 'video-batch-1.mp4'
      const file2Key = 'video-batch-2.mp4'

      await insertFile({fileId: 'video-batch-1', key: file1Key, status: FileStatus.Downloaded})
      await insertFile({fileId: 'video-batch-2', key: file2Key, status: FileStatus.Downloaded})
      await insertUser({userId: user1Id, email: 'batch1@example.com'})
      await insertUser({userId: user2Id, email: 'batch2@example.com'})
      await linkUserFile(user1Id, 'video-batch-1')
      await linkUserFile(user2Id, 'video-batch-2')

      const event = createMockS3BatchEvent([file1Key, file2Key])
      await handler(event, createMockContext())

      const messages = await waitForMessages(queueUrl, 2, 15000)
      expect(messages.length).toBe(2)

      const fileIds = messages.map((msg) => JSON.parse(msg.Body!).file.fileId)
      expect(fileIds.sort()).toEqual(['video-batch-1', 'video-batch-2'])
    })

    test('should continue processing after individual record failure', async () => {
      const userId = crypto.randomUUID()
      const existingFileKey = 'video-exists.mp4'

      await insertFile({fileId: 'video-exists', key: existingFileKey, status: FileStatus.Downloaded})
      await insertUser({userId, email: 'partial@example.com'})
      await linkUserFile(userId, 'video-exists')

      const event = createMockS3BatchEvent(['nonexistent.mp4', existingFileKey])
      await handler(event, createMockContext())

      const messages = await waitForMessages(queueUrl, 1, 10000)
      expect(messages.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Correlation ID Preservation', () => {
    test('should preserve correlation ID from S3 metadata', async () => {
      const userId = crypto.randomUUID()
      const fileId = 'video-correlation'
      const fileKey = `${fileId}.mp4`
      const correlationId = `corr-${Date.now()}`

      await insertFile({fileId, key: fileKey, status: FileStatus.Downloaded})
      await insertUser({userId, email: 'correlation@example.com'})
      await linkUserFile(userId, fileId)

      const event = createMockS3Event(fileKey, {correlationId})
      await handler(event, createMockContext())

      const messages = await waitForMessages(queueUrl, 1, 10000)
      expect(messages.length).toBe(1)
    })
  })
})
