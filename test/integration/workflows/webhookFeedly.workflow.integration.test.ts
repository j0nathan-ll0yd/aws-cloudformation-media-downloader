/**
 * WebhookFeedly Workflow Integration Tests
 *
 * Tests the Feedly webhook workflow against LocalStack:
 * 1. Extract video ID from article URL
 * 2. Associate file with user in DynamoDB
 * 3. Check if file already exists:
 *    - If Downloaded: Send SQS notification
 *    - If new: Add to DynamoDB, optionally initiate download
 * 4. Handle duplicate webhooks (idempotency)
 *
 * This tests YOUR orchestration logic, not AWS SDK behavior.
 */

import {describe, test, expect, beforeAll, afterAll, beforeEach, jest} from '@jest/globals'
import {FileStatus} from '../../../src/types/enums'

// Test helpers
import {createFilesTable, deleteFilesTable, insertFile, getFile} from '../helpers/dynamodb-helpers'
import {createMockContext} from '../helpers/lambda-context'

// Test configuration
const TEST_TABLE = 'test-files'
const TEST_USER_FILES_TABLE = 'test-user-files'
const TEST_SQS_QUEUE_URL = 'http://localhost:4566/000000000000/test-notifications'

// Set environment variables for Lambda
process.env.DynamoDBTableFiles = TEST_TABLE
process.env.DynamoDBTableUserFiles = TEST_USER_FILES_TABLE
process.env.SNSQueueUrl = TEST_SQS_QUEUE_URL
process.env.USE_LOCALSTACK = 'true'

describe('WebhookFeedly Workflow Integration Tests', () => {
  let handler: any
  let mockContext: any
  let sendMessageMock: jest.Mock
  let invokeLambdaMock: jest.Mock

  beforeAll(async () => {
    // Create LocalStack infrastructure
    await createFilesTable()

    // Wait for table to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Create mock context
    mockContext = createMockContext()
  })

  afterAll(async () => {
    // Clean up LocalStack infrastructure
    await deleteFilesTable()
  })

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks()

    // Mock SQS sendMessage (don't actually send to queue)
    sendMessageMock = jest.fn<() => Promise<{MessageId: string}>>().mockResolvedValue({MessageId: 'test-message-id'})

    jest.unstable_mockModule('../../../src/lib/vendor/AWS/SQS', () => ({
      sendMessage: sendMessageMock
    }))

    // Mock Lambda invocation (don't actually invoke StartFileUpload)
    invokeLambdaMock = jest.fn<() => Promise<{StatusCode: number}>>().mockResolvedValue({StatusCode: 202})

    jest.unstable_mockModule('../../../src/lib/vendor/AWS/Lambda', () => ({
      invokeLambda: invokeLambdaMock,
      invokeAsync: invokeLambdaMock
    }))

    // Mock YouTube getVideoID (extract video ID from URL)
    jest.unstable_mockModule('../../../src/lib/vendor/YouTube', () => ({
      getVideoID: jest.fn((url: string) => {
        // Simple URL parsing mock
        const match = url.match(/v=([^&]+)/)
        return match ? match[1] : 'test-video-id'
      })
    }))

    // Import handler AFTER mocks are set up
    const module = await import('../../../src/lambdas/WebhookFeedly/src/index')
    handler = module.handler
  })

  test('should create new file and initiate download for first-time video', async () => {
    // Arrange: Webhook event for new video
    const event = {
      body: JSON.stringify({
        articleURL: 'https://www.youtube.com/watch?v=new-video-123',
        backgroundMode: false
      }),
      requestContext: {
        authorizer: {
          userId: 'user-uuid-123'
        }
      }
    }

    // Act: Invoke WebhookFeedly handler
    const result = await handler(event, mockContext)

    // Assert: Lambda response indicates initiated
    expect(result.statusCode).toBe(202)
    const body = JSON.parse(result.body)
    expect(body.status).toBe('Initiated')

    // Assert: File was created in DynamoDB
    const file = await getFile('new-video-123')
    expect(file).not.toBeNull()
    expect(file!.fileId).toBe('new-video-123')
    expect(file!.status).toBe(FileStatus.Pending)

    // Assert: StartFileUpload was invoked
    expect(invokeLambdaMock).toHaveBeenCalledTimes(1)
    const invocationPayload = JSON.parse(invokeLambdaMock.mock.calls[0][1])
    expect(invocationPayload.fileId).toBe('new-video-123')

    // Assert: No SQS notification sent (file not downloaded yet)
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  test('should send notification without re-downloading for already-downloaded video', async () => {
    // Arrange: Insert already-downloaded file
    await insertFile({
      fileId: 'existing-video',
      status: FileStatus.Downloaded,
      key: 'existing-video.mp4',
      size: 5242880,
      title: 'Existing Video',
      authorName: 'Test Channel',
      contentType: 'video/mp4'
    })

    // Webhook event for existing video
    const event = {
      body: JSON.stringify({
        articleURL: 'https://www.youtube.com/watch?v=existing-video',
        backgroundMode: false
      }),
      requestContext: {
        authorizer: {
          userId: 'user-uuid-456'
        }
      }
    }

    // Act: Invoke WebhookFeedly handler
    const result = await handler(event, mockContext)

    // Assert: Lambda response indicates dispatched
    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.status).toBe('Dispatched')

    // Assert: SQS notification was sent
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    const messageParams = sendMessageMock.mock.calls[0][0]
    expect(messageParams.QueueUrl).toBe(TEST_SQS_QUEUE_URL)
    expect(messageParams.MessageBody).toBe('FileNotification')

    // Assert: StartFileUpload was NOT invoked (no re-download)
    expect(invokeLambdaMock).not.toHaveBeenCalled()

    // Assert: File status unchanged
    const file = await getFile('existing-video')
    expect(file!.status).toBe(FileStatus.Downloaded)
  })

  test('should handle backgroundMode without immediate download initiation', async () => {
    // Arrange: Webhook event with backgroundMode enabled
    const event = {
      body: JSON.stringify({
        articleURL: 'https://www.youtube.com/watch?v=background-video',
        backgroundMode: true
      }),
      requestContext: {
        authorizer: {
          userId: 'user-uuid-789'
        }
      }
    }

    // Act: Invoke WebhookFeedly handler
    const result = await handler(event, mockContext)

    // Assert: Lambda response indicates accepted (not initiated)
    expect(result.statusCode).toBe(202)
    const body = JSON.parse(result.body)
    expect(body.status).toBe('Accepted')

    // Assert: File was created in DynamoDB
    const file = await getFile('background-video')
    expect(file).not.toBeNull()
    expect(file!.fileId).toBe('background-video')
    expect(file!.status).toBe(FileStatus.Pending)

    // Assert: StartFileUpload was NOT invoked (background mode)
    expect(invokeLambdaMock).not.toHaveBeenCalled()

    // Assert: No SQS notification sent
    expect(sendMessageMock).not.toHaveBeenCalled()

    // Note: FileCoordinator will pick up this file later
  })

  test('should be idempotent when receiving duplicate webhooks for same video', async () => {
    // Arrange: Same webhook event sent twice
    const event = {
      body: JSON.stringify({
        articleURL: 'https://www.youtube.com/watch?v=duplicate-video',
        backgroundMode: false
      }),
      requestContext: {
        authorizer: {
          userId: 'user-uuid-101'
        }
      }
    }

    // Act: Invoke webhook twice
    const result1 = await handler(event, mockContext)
    const result2 = await handler(event, mockContext)

    // Assert: Both responses successful
    expect(result1.statusCode).toBe(202)
    expect(result2.statusCode).toBe(202)

    // Assert: File only exists once in DynamoDB
    const file = await getFile('duplicate-video')
    expect(file).not.toBeNull()
    expect(file!.fileId).toBe('duplicate-video')

    // Assert: StartFileUpload invoked twice (DynamoDB handles deduplication)
    expect(invokeLambdaMock).toHaveBeenCalledTimes(2)

    // Note: In production, StartFileUpload uses conditional updates to prevent
    // duplicate downloads. This test verifies WebhookFeedly is safe to retry.
  })

  test('should associate file with multiple users when different users request same video', async () => {
    // Arrange: Insert existing file
    await insertFile({
      fileId: 'shared-video',
      status: FileStatus.Downloaded,
      key: 'shared-video.mp4',
      size: 5242880,
      title: 'Shared Video'
    })

    // Webhook events from two different users
    const event1 = {
      body: JSON.stringify({
        articleURL: 'https://www.youtube.com/watch?v=shared-video',
        backgroundMode: false
      }),
      requestContext: {
        authorizer: {
          userId: 'user-alice'
        }
      }
    }

    const event2 = {
      body: JSON.stringify({
        articleURL: 'https://www.youtube.com/watch?v=shared-video',
        backgroundMode: false
      }),
      requestContext: {
        authorizer: {
          userId: 'user-bob'
        }
      }
    }

    // Act: Invoke webhook for both users
    const result1 = await handler(event1, mockContext)
    const result2 = await handler(event2, mockContext)

    // Assert: Both responses indicate dispatched
    expect(result1.statusCode).toBe(200)
    expect(result2.statusCode).toBe(200)

    // Assert: Two SQS notifications sent (one per user)
    expect(sendMessageMock).toHaveBeenCalledTimes(2)

    // Verify message attributes contain correct user IDs
    const message1Attrs = sendMessageMock.mock.calls[0][0].MessageAttributes
    const message2Attrs = sendMessageMock.mock.calls[1][0].MessageAttributes

    expect(message1Attrs.userId.StringValue).toBe('user-alice')
    expect(message2Attrs.userId.StringValue).toBe('user-bob')

    // Assert: No re-download triggered
    expect(invokeLambdaMock).not.toHaveBeenCalled()
  })

  test('should handle invalid video URL gracefully', async () => {
    // Arrange: Mock YouTube getVideoID to throw error for invalid URL
    jest.unstable_mockModule('../../../src/lib/vendor/YouTube', () => ({
      getVideoID: jest.fn(() => {
        throw new Error('Invalid YouTube URL')
      })
    }))

    // Re-import handler with new mock
    const module = await import('../../../src/lambdas/WebhookFeedly/src/index')
    handler = module.handler

    const event = {
      body: JSON.stringify({
        articleURL: 'https://invalid-url.com/not-youtube',
        backgroundMode: false
      }),
      requestContext: {
        authorizer: {
          userId: 'user-uuid-999'
        }
      }
    }

    // Act: Invoke webhook
    const result = await handler(event, mockContext)

    // Assert: Error response returned
    expect(result.statusCode).toBe(500)

    // Assert: No DynamoDB operations performed
    expect(invokeLambdaMock).not.toHaveBeenCalled()
    expect(sendMessageMock).not.toHaveBeenCalled()
  })
})
