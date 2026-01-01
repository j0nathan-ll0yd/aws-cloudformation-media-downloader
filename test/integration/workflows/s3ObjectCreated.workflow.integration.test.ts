/**
 * S3ObjectCreated Workflow Integration Tests
 *
 * Tests the S3 object creation workflow:
 * - Entity queries: Mocked for file and user lookups (handlers use own Drizzle connection)
 * - SQS: Uses REAL LocalStack for notification dispatch
 *
 * Workflow:
 * 1. S3 event triggers Lambda with object key
 * 2. Look up file by S3 key via entity queries (mocked - handler uses own DB)
 * 3. Find all users associated with the file (mocked)
 * 4. Dispatch SQS message for each user (REAL LocalStack)
 *
 * NOTE: Entity mocks remain because handlers use their own Drizzle connection.
 * Phase 4 will address full database integration.
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'

import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'
import type {Context} from 'aws-lambda'
import {FileStatus} from '#types/enums'

// Test helpers
import {createMockContext} from '../helpers/lambda-context'
import {createMockFile, createMockS3Event} from '../helpers/test-data'
import {clearTestQueue, createTestQueue, deleteTestQueue, receiveAndDeleteMessages} from '../helpers/sqs-helpers'

// Mock entity queries - must use vi.hoisted for ESM
// NOTE: These remain mocked because handlers use their own Drizzle connection
const {getFilesByKeyMock, getUserFilesByFileIdMock} = vi.hoisted(() => ({getFilesByKeyMock: vi.fn(), getUserFilesByFileIdMock: vi.fn()}))

vi.mock('#entities/queries', () => ({getFilesByKey: getFilesByKeyMock, getUserFilesByFileId: getUserFilesByFileIdMock}))

// NO SQS mock - uses real LocalStack SQS
// The handler calls sendMessage from #lib/vendor/AWS/SQS which uses createSQSClient()
// createSQSClient() respects USE_LOCALSTACK=true and points to LocalStack

// Import handler after mocks
const {handler} = await import('#lambdas/S3ObjectCreated/src/index')

describe('S3ObjectCreated Workflow Integration Tests', () => {
  let mockContext: Context
  let queueUrl: string
  const testQueueName = `test-s3-object-queue-${Date.now()}`

  beforeAll(async () => {
    mockContext = createMockContext()

    // Create real LocalStack SQS queue
    const queue = await createTestQueue(testQueueName)
    queueUrl = queue.queueUrl
    process.env.SNS_QUEUE_URL = queueUrl
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    // Clear any messages from previous tests
    await clearTestQueue(queueUrl)
    // Default mock implementations
    getFilesByKeyMock.mockResolvedValue([])
    getUserFilesByFileIdMock.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  afterAll(async () => {
    // Clean up LocalStack resources
    await deleteTestQueue(queueUrl)
  })

  test('should dispatch notification to user when file is uploaded using real LocalStack SQS', async () => {
    const userId = crypto.randomUUID()
    const fileKey = 'videos/test-video.mp4'
    const mockFile = createMockFile('test-file-1', FileStatus.Downloaded, {key: fileKey, title: 'Test Video'})

    getFilesByKeyMock.mockResolvedValue([mockFile])
    getUserFilesByFileIdMock.mockResolvedValue([{userId, fileId: 'test-file-1'}])

    await handler(createMockS3Event(fileKey), mockContext)

    // Verify message was actually delivered to LocalStack SQS
    const messages = await receiveAndDeleteMessages(queueUrl, 10, 2)
    expect(messages).toHaveLength(1)
    expect(messages[0].attributes.userId).toBe(userId)
  })

  test('should dispatch notifications to multiple users for shared file', async () => {
    const userId1 = crypto.randomUUID()
    const userId2 = crypto.randomUUID()
    const userId3 = crypto.randomUUID()
    const fileKey = 'videos/shared-video.mp4'
    const mockFile = createMockFile('shared-file', FileStatus.Downloaded, {key: fileKey, title: 'Shared Video'})

    getFilesByKeyMock.mockResolvedValue([mockFile])
    getUserFilesByFileIdMock.mockResolvedValue([
      {userId: userId1, fileId: 'shared-file'},
      {userId: userId2, fileId: 'shared-file'},
      {userId: userId3, fileId: 'shared-file'}
    ])

    await handler(createMockS3Event(fileKey), mockContext)

    // Verify all 3 messages arrived in real LocalStack SQS
    const messages = await receiveAndDeleteMessages(queueUrl, 10, 2)
    expect(messages).toHaveLength(3)

    const userIds = messages.map((m) => m.attributes.userId).sort()
    expect(userIds).toEqual([userId1, userId2, userId3].sort())
  })

  test('should handle file with no users gracefully', async () => {
    const fileKey = 'videos/orphan-video.mp4'
    const mockFile = createMockFile('orphan-file', FileStatus.Downloaded, {key: fileKey, title: 'Orphan Video'})

    getFilesByKeyMock.mockResolvedValue([mockFile])
    getUserFilesByFileIdMock.mockResolvedValue([])

    await handler(createMockS3Event(fileKey), mockContext)

    // Verify no messages were sent
    const messages = await receiveAndDeleteMessages(queueUrl, 10, 1)
    expect(messages).toHaveLength(0)
  })

  test('should handle URL-encoded S3 keys correctly', async () => {
    const userId = crypto.randomUUID()
    const fileKey = 'videos/file with spaces.mp4'
    const mockFile = createMockFile('spaced-file', FileStatus.Downloaded, {key: fileKey, title: 'File With Spaces'})

    getFilesByKeyMock.mockResolvedValue([mockFile])
    getUserFilesByFileIdMock.mockResolvedValue([{userId, fileId: 'spaced-file'}])

    await handler(createMockS3Event(fileKey), mockContext)

    // Verify message arrived with correct data
    const messages = await receiveAndDeleteMessages(queueUrl, 10, 2)
    expect(messages).toHaveLength(1)
    expect(messages[0].attributes.userId).toBe(userId)
  })

  test('should include notification type in message attributes', async () => {
    const userId = crypto.randomUUID()
    const fileKey = 'videos/notify-type-test.mp4'
    const mockFile = createMockFile('notify-file', FileStatus.Downloaded, {key: fileKey, title: 'Notification Type Test'})

    getFilesByKeyMock.mockResolvedValue([mockFile])
    getUserFilesByFileIdMock.mockResolvedValue([{userId, fileId: 'notify-file'}])

    await handler(createMockS3Event(fileKey), mockContext)

    // Verify message has proper notification type (DownloadReadyNotification for completed uploads)
    const messages = await receiveAndDeleteMessages(queueUrl, 10, 2)
    expect(messages).toHaveLength(1)
    expect(messages[0].attributes.notificationType).toBe('DownloadReadyNotification')
  })
})
