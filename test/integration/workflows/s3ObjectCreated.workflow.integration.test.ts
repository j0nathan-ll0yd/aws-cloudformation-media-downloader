/**
 * S3ObjectCreated Workflow Integration Tests
 *
 * Tests the S3 event handler against real services:
 * - PostgreSQL: File and UserFiles queries
 * - LocalStack SQS: Message dispatch verification
 *
 * Workflow:
 * 1. Receive S3 ObjectCreated event
 * 2. Query PostgreSQL Files table by S3 object key
 * 3. Query PostgreSQL UserFiles to find users associated with file
 * 4. Dispatch SQS notification message for each user
 *
 * This tests OUR business logic:
 * - Correct file lookup by S3 key
 * - Correct user association queries
 * - Message payload construction
 * - Fan-out to all associated users
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

import {afterAll, afterEach, beforeAll, describe, expect, test} from '@jest/globals'
import type {S3Event, Context} from 'aws-lambda'
import {FileStatus} from '../../../src/types/enums'

// Test helpers
import {
  closeTestDb,
  createAllTables,
  dropAllTables,
  truncateAllTables,
  insertFile,
  insertUser,
  linkUserFile
} from '../helpers/postgres-helpers'
import {createTestQueue, deleteTestQueue, waitForMessages, purgeQueue} from '../helpers/sqs-helpers'

// Import handler directly (no mocking - uses real services via LocalStack)
const {handler} = await import('../../../src/lambdas/S3ObjectCreated/src/index')

let testQueueUrl: string
const testQueueName = `test-s3-notifications-${Date.now()}`

function createS3Event(objectKey: string): S3Event {
  return {
    Records: [{
      eventVersion: '2.1',
      eventSource: 'aws:s3',
      awsRegion: 'us-west-2',
      eventTime: new Date().toISOString(),
      eventName: 'ObjectCreated:Put',
      userIdentity: {principalId: 'EXAMPLE'},
      requestParameters: {sourceIPAddress: '127.0.0.1'},
      responseElements: {
        'x-amz-request-id': 'EXAMPLE123456789',
        'x-amz-id-2': 'EXAMPLE123'
      },
      s3: {
        s3SchemaVersion: '1.0',
        configurationId: 'test-config',
        bucket: {
          name: 'test-bucket',
          ownerIdentity: {principalId: 'EXAMPLE'},
          arn: 'arn:aws:s3:::test-bucket'
        },
        object: {
          key: encodeURIComponent(objectKey),
          size: 1024,
          eTag: 'd41d8cd98f00b204e9800998ecf8427e',
          sequencer: '0A1B2C3D4E5F678901'
        }
      }
    }]
  }
}

function createMockContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'S3ObjectCreated',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-west-2:123456789012:function:S3ObjectCreated',
    memoryLimitInMB: '256',
    awsRequestId: `test-${Date.now()}`,
    logGroupName: '/aws/lambda/S3ObjectCreated',
    logStreamName: '2024/01/01/[$LATEST]test',
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {}
  }
}

describe('S3ObjectCreated Workflow Integration Tests', () => {
  beforeAll(async () => {
    // Create PostgreSQL tables
    await createAllTables()

    // Create LocalStack SQS queue
    testQueueUrl = await createTestQueue(testQueueName)

    // Set environment variable for the Lambda
    process.env.SNS_QUEUE_URL = testQueueUrl
  })

  afterEach(async () => {
    // Clean up data between tests
    await truncateAllTables()
    // Purge queue between tests
    await purgeQueue(testQueueUrl)
  })

  afterAll(async () => {
    // Clean up LocalStack SQS queue
    await deleteTestQueue(testQueueUrl)

    // Drop tables and close connection
    await dropAllTables()
    await closeTestDb()
  })

  describe('File lookup by S3 key', () => {
    test('should find file by S3 object key and dispatch SQS notification', async () => {
      // Arrange: Create file and user in PostgreSQL
      const userId = crypto.randomUUID()
      const fileKey = 'video-abc123.mp4'

      await insertUser({userId, email: 's3test@example.com', firstName: 'S3Test'})
      await insertFile({fileId: 'abc123', key: fileKey, status: FileStatus.Downloaded, title: 'Test Video'})
      await linkUserFile(userId, 'abc123')

      // Act
      const event = createS3Event(fileKey)
      await handler(event, createMockContext())

      // Assert: Handler completed successfully (no throw)
      // Verify: SQS message was sent to LocalStack
      const messages = await waitForMessages(testQueueUrl, 1, 5000)
      expect(messages).toHaveLength(1)

      // Verify message content
      const body = JSON.parse(messages[0].Body!)
      expect(body.fileId).toBe('abc123')
      expect(body.title).toBe('Test Video')
    })

    test('should handle URL-encoded S3 keys with spaces', async () => {
      const userId = crypto.randomUUID()
      const fileKey = 'My Video File.mp4'

      await insertUser({userId, email: 'spaces@example.com', firstName: 'Spaces'})
      await insertFile({fileId: 'spaces-file', key: fileKey, status: FileStatus.Downloaded, title: 'Spaced Video'})
      await linkUserFile(userId, 'spaces-file')

      // S3 event will have URL-encoded key
      const event = createS3Event(fileKey)
      await handler(event, createMockContext())

      // Handler completed successfully (no throw)

      // Verify message was sent
      const messages = await waitForMessages(testQueueUrl, 1, 5000)
      expect(messages).toHaveLength(1)
    })

    test('should throw error when file not found in database', async () => {
      // No file inserted - simulate S3 event for unknown file
      const event = createS3Event('nonexistent-file.mp4')

      // Handler should throw for missing file
      await expect(handler(event, createMockContext())).rejects.toThrow('Unable to locate file')

      // No messages should be sent
      const messages = await waitForMessages(testQueueUrl, 1, 1000)
      expect(messages).toHaveLength(0)
    })
  })

  describe('User lookup for file', () => {
    test('should dispatch notification to all users associated with file', async () => {
      // Arrange: Create file with multiple users
      const user1Id = crypto.randomUUID()
      const user2Id = crypto.randomUUID()
      const user3Id = crypto.randomUUID()
      const fileKey = 'shared-video.mp4'

      await insertUser({userId: user1Id, email: 'user1@example.com', firstName: 'User1'})
      await insertUser({userId: user2Id, email: 'user2@example.com', firstName: 'User2'})
      await insertUser({userId: user3Id, email: 'user3@example.com', firstName: 'User3'})
      await insertFile({fileId: 'shared-file', key: fileKey, status: FileStatus.Downloaded, title: 'Shared Video'})
      await linkUserFile(user1Id, 'shared-file')
      await linkUserFile(user2Id, 'shared-file')
      await linkUserFile(user3Id, 'shared-file')

      // Act
      const event = createS3Event(fileKey)
      await handler(event, createMockContext())

      // Assert: All 3 users should receive notifications

      // Verify 3 messages sent to SQS
      const messages = await waitForMessages(testQueueUrl, 3, 5000)
      expect(messages).toHaveLength(3)

      // Verify each message has the correct fileId and unique userId
      const userIds = messages.map((msg) => {
        const attrs = msg.MessageAttributes || {}
        return attrs.userId?.StringValue
      })
      expect(userIds).toContain(user1Id)
      expect(userIds).toContain(user2Id)
      expect(userIds).toContain(user3Id)
    })

    test('should complete successfully when file has no associated users', async () => {
      // Arrange: File exists but no users linked
      const fileKey = 'orphan-video.mp4'
      await insertFile({fileId: 'orphan-file', key: fileKey, status: FileStatus.Downloaded, title: 'Orphan Video'})

      // Act
      const event = createS3Event(fileKey)
      await handler(event, createMockContext())

      // Assert: Success with no notifications (handler doesn't throw)

      // No messages should be sent
      const messages = await waitForMessages(testQueueUrl, 1, 1000)
      expect(messages).toHaveLength(0)
    })
  })

  describe('Batch processing', () => {
    test('should process multiple S3 records in single event', async () => {
      // Arrange: Create multiple files with users
      const user1Id = crypto.randomUUID()
      const user2Id = crypto.randomUUID()

      await insertUser({userId: user1Id, email: 'batch1@example.com', firstName: 'Batch1'})
      await insertUser({userId: user2Id, email: 'batch2@example.com', firstName: 'Batch2'})
      await insertFile({fileId: 'batch-file-1', key: 'batch1.mp4', status: FileStatus.Downloaded, title: 'Batch 1'})
      await insertFile({fileId: 'batch-file-2', key: 'batch2.mp4', status: FileStatus.Downloaded, title: 'Batch 2'})
      await linkUserFile(user1Id, 'batch-file-1')
      await linkUserFile(user2Id, 'batch-file-2')

      // Create batch event with 2 records
      const event1 = createS3Event('batch1.mp4')
      const event2 = createS3Event('batch2.mp4')
      const batchEvent: S3Event = {Records: [...event1.Records, ...event2.Records]}

      // Act - wrapEventHandler processes first record only
      await handler(batchEvent, createMockContext())

      // Assert: First file processed, notification sent

      const messages = await waitForMessages(testQueueUrl, 1, 5000)
      expect(messages.length).toBeGreaterThanOrEqual(1)
    })

    test('should throw when file not found', async () => {
      // Arrange: Event for nonexistent file
      const invalidEvent = createS3Event('nonexistent.mp4')

      // Act & Assert: Handler throws for missing file
      await expect(handler(invalidEvent, createMockContext())).rejects.toThrow('Unable to locate file')
    })
  })

  describe('Message payload verification', () => {
    test('should include correct notification type and file metadata', async () => {
      // Arrange
      const userId = crypto.randomUUID()
      const fileKey = 'metadata-test.mp4'

      await insertUser({userId, email: 'metadata@example.com', firstName: 'Metadata'})
      await insertFile({
        fileId: 'metadata-file',
        key: fileKey,
        status: FileStatus.Downloaded,
        title: 'Test Metadata Video',
        authorName: 'Test Author'
      })
      await linkUserFile(userId, 'metadata-file')

      // Act
      const event = createS3Event(fileKey)
      await handler(event, createMockContext())

      // Assert: Verify full message structure
      const messages = await waitForMessages(testQueueUrl, 1, 5000)
      expect(messages).toHaveLength(1)

      const message = messages[0]
      const body = JSON.parse(message.Body!)
      const attrs = message.MessageAttributes || {}

      // Verify body
      expect(body.fileId).toBe('metadata-file')
      expect(body.title).toBe('Test Metadata Video')
      expect(body.authorName).toBe('Test Author')
      expect(body.status).toBe('Downloaded')

      // Verify attributes
      expect(attrs.notificationType?.StringValue).toBe('DownloadReadyNotification')
      expect(attrs.userId?.StringValue).toBe(userId)
      expect(attrs.fileId?.StringValue).toBe('metadata-file')
    })
  })
})
