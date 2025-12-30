/**
 * S3ObjectCreated Workflow Integration Tests
 *
 * Tests the S3 object creation workflow:
 * - Entity queries: Mocked for file and user lookups
 * - SQS: Mocked for notification dispatch
 *
 * Workflow:
 * 1. S3 event triggers Lambda with object key
 * 2. Look up file by S3 key via entity queries (mocked)
 * 3. Find all users associated with the file (mocked)
 * 4. Dispatch SQS message for each user
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.SNS_QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/123456789012/test-queue'

import {afterEach, beforeAll, describe, expect, test, vi} from 'vitest'
import type {Context} from 'aws-lambda'
import {FileStatus} from '#types/enums'

// Test helpers
import {createMockContext} from '../helpers/lambda-context'
import {createMockFile, createMockS3Event} from '../helpers/test-data'

// Mock entity queries - must use vi.hoisted for ESM
const {getFilesByKeyMock, getUserFilesByFileIdMock} = vi.hoisted(() => ({getFilesByKeyMock: vi.fn(), getUserFilesByFileIdMock: vi.fn()}))

vi.mock('#entities/queries', () => ({getFilesByKey: getFilesByKeyMock, getUserFilesByFileId: getUserFilesByFileIdMock}))

// Mock SQS vendor wrapper - include stringAttribute helper used by Lambda
const sendMessageMock = vi.fn()
const stringAttribute = (value: string) => ({DataType: 'String', StringValue: value})
vi.mock('#lib/vendor/AWS/SQS', () => ({sendMessage: sendMessageMock, stringAttribute}))

// Import handler after mocks
const {handler} = await import('#lambdas/S3ObjectCreated/src/index')

describe('S3ObjectCreated Workflow Integration Tests', () => {
  let mockContext: Context

  beforeAll(() => {
    mockContext = createMockContext()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('should dispatch notification to user when file is uploaded', async () => {
    const userId = crypto.randomUUID()
    const fileKey = 'videos/test-video.mp4'
    const mockFile = createMockFile('test-file-1', FileStatus.Downloaded, {key: fileKey, title: 'Test Video'})

    getFilesByKeyMock.mockResolvedValue([mockFile])
    getUserFilesByFileIdMock.mockResolvedValue([{userId, fileId: 'test-file-1'}])
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
    const mockFile = createMockFile('shared-file', FileStatus.Downloaded, {key: fileKey, title: 'Shared Video'})

    getFilesByKeyMock.mockResolvedValue([mockFile])
    getUserFilesByFileIdMock.mockResolvedValue([
      {userId: userId1, fileId: 'shared-file'},
      {userId: userId2, fileId: 'shared-file'},
      {userId: userId3, fileId: 'shared-file'}
    ])
    sendMessageMock.mockResolvedValue({MessageId: 'test-msg-id'})

    await handler(createMockS3Event(fileKey), mockContext)

    expect(sendMessageMock).toHaveBeenCalledTimes(3)
  })

  test('should handle file with no users gracefully', async () => {
    const fileKey = 'videos/orphan-video.mp4'
    const mockFile = createMockFile('orphan-file', FileStatus.Downloaded, {key: fileKey, title: 'Orphan Video'})

    getFilesByKeyMock.mockResolvedValue([mockFile])
    getUserFilesByFileIdMock.mockResolvedValue([])

    await handler(createMockS3Event(fileKey), mockContext)

    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  test('should handle URL-encoded S3 keys correctly', async () => {
    const userId = crypto.randomUUID()
    const fileKey = 'videos/file with spaces.mp4'
    const mockFile = createMockFile('spaced-file', FileStatus.Downloaded, {key: fileKey, title: 'File With Spaces'})

    getFilesByKeyMock.mockResolvedValue([mockFile])
    getUserFilesByFileIdMock.mockResolvedValue([{userId, fileId: 'spaced-file'}])
    sendMessageMock.mockResolvedValue({MessageId: 'test-msg-id'})

    await handler(createMockS3Event(fileKey), mockContext)

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })

  test('should continue processing when one notification fails', async () => {
    const userId1 = crypto.randomUUID()
    const userId2 = crypto.randomUUID()
    const fileKey = 'videos/partial-failure.mp4'
    const mockFile = createMockFile('partial-file', FileStatus.Downloaded, {key: fileKey, title: 'Partial Failure'})

    getFilesByKeyMock.mockResolvedValue([mockFile])
    getUserFilesByFileIdMock.mockResolvedValue([
      {userId: userId1, fileId: 'partial-file'},
      {userId: userId2, fileId: 'partial-file'}
    ])
    sendMessageMock.mockRejectedValueOnce(new Error('SQS send failed')).mockResolvedValueOnce({MessageId: 'test-msg-id'})

    await handler(createMockS3Event(fileKey), mockContext)

    expect(sendMessageMock).toHaveBeenCalledTimes(2)
  })
})
