/**
 * S3ObjectCreated Workflow Integration Tests
 *
 * Tests the S3 object creation workflow against real services:
 * - PostgreSQL: File and UserFile records
 * - SQS: Mocked for notification dispatch
 *
 * Workflow:
 * 1. S3 event triggers Lambda with object key
 * 2. Look up file by S3 key in PostgreSQL
 * 3. Find all users associated with the file
 * 4. Dispatch SQS message for each user
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'
process.env.SNS_QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/123456789012/test-queue'

import {afterAll, afterEach, beforeAll, describe, expect, test, vi} from 'vitest'
import type {Context} from 'aws-lambda'
import {FileStatus} from '#types/enums'

// Test helpers
import {closeTestDb, createAllTables, dropAllTables, insertFile, insertUser, linkUserFile, truncateAllTables} from '../helpers/postgres-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createMockS3Event} from '../helpers/test-data'

// Mock SQS vendor wrapper
const sendMessageMock = vi.fn()
vi.mock('#lib/vendor/AWS/SQS', () => ({sendMessage: sendMessageMock}))

// Import handler after mocks
const {handler} = await import('#lambdas/S3ObjectCreated/src/index')

describe('S3ObjectCreated Workflow Integration Tests', () => {
  let mockContext: Context

  beforeAll(async () => {
    await createAllTables()
    mockContext = createMockContext()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await truncateAllTables()
  })

  afterAll(async () => {
    await dropAllTables()
    await closeTestDb()
  })

  test('should dispatch notification to user when file is uploaded', async () => {
    const userId = crypto.randomUUID()
    const fileKey = 'videos/test-video.mp4'

    await insertUser({userId, email: 's3upload@example.com', firstName: 'S3Upload'})
    await insertFile({fileId: 'test-file-1', status: FileStatus.Downloaded, key: fileKey, title: 'Test Video'})
    await linkUserFile(userId, 'test-file-1')

    sendMessageMock.mockResolvedValue({MessageId: 'test-msg-id'})

    await handler(createMockS3Event(fileKey), mockContext)

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(sendMessageMock).toHaveBeenCalledWith(expect.objectContaining({QueueUrl: process.env.SNS_QUEUE_URL}))
  })

  test('should dispatch notifications to multiple users for shared file', async () => {
    const userId1 = crypto.randomUUID()
    const userId2 = crypto.randomUUID()
    const userId3 = crypto.randomUUID()
    const fileKey = 'videos/shared-video.mp4'

    await insertUser({userId: userId1, email: 'user1@example.com', firstName: 'User1'})
    await insertUser({userId: userId2, email: 'user2@example.com', firstName: 'User2'})
    await insertUser({userId: userId3, email: 'user3@example.com', firstName: 'User3'})

    await insertFile({fileId: 'shared-file', status: FileStatus.Downloaded, key: fileKey, title: 'Shared Video'})

    await linkUserFile(userId1, 'shared-file')
    await linkUserFile(userId2, 'shared-file')
    await linkUserFile(userId3, 'shared-file')

    sendMessageMock.mockResolvedValue({MessageId: 'test-msg-id'})

    await handler(createMockS3Event(fileKey), mockContext)

    expect(sendMessageMock).toHaveBeenCalledTimes(3)
  })

  test('should handle file with no users gracefully', async () => {
    const fileKey = 'videos/orphan-video.mp4'

    await insertFile({fileId: 'orphan-file', status: FileStatus.Downloaded, key: fileKey, title: 'Orphan Video'})

    await handler(createMockS3Event(fileKey), mockContext)

    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  test('should handle URL-encoded S3 keys correctly', async () => {
    const userId = crypto.randomUUID()
    const fileKey = 'videos/file with spaces.mp4'

    await insertUser({userId, email: 'urlencoded@example.com', firstName: 'URLEncoded'})
    await insertFile({fileId: 'spaced-file', status: FileStatus.Downloaded, key: fileKey, title: 'File With Spaces'})
    await linkUserFile(userId, 'spaced-file')

    sendMessageMock.mockResolvedValue({MessageId: 'test-msg-id'})

    await handler(createMockS3Event(fileKey), mockContext)

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })

  test('should continue processing when one notification fails', async () => {
    const userId1 = crypto.randomUUID()
    const userId2 = crypto.randomUUID()
    const fileKey = 'videos/partial-failure.mp4'

    await insertUser({userId: userId1, email: 'fail@example.com', firstName: 'Fail'})
    await insertUser({userId: userId2, email: 'success@example.com', firstName: 'Success'})

    await insertFile({fileId: 'partial-file', status: FileStatus.Downloaded, key: fileKey, title: 'Partial Failure'})

    await linkUserFile(userId1, 'partial-file')
    await linkUserFile(userId2, 'partial-file')

    sendMessageMock.mockRejectedValueOnce(new Error('SQS send failed')).mockResolvedValueOnce({MessageId: 'test-msg-id'})

    await handler(createMockS3Event(fileKey), mockContext)

    expect(sendMessageMock).toHaveBeenCalledTimes(2)
  })
})
