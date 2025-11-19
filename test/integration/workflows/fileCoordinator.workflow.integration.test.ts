/**
 * FileCoordinator Workflow Integration Tests
 *
 * Tests the file coordination workflow against LocalStack:
 * 1. Scan DynamoDB for files ready to download (availableAt <= now AND no url)
 * 2. Fan-out: Invoke StartFileUpload Lambda for each pending file
 * 3. Handle empty queue gracefully
 *
 * This tests YOUR orchestration logic, not AWS SDK behavior.
 */

import {describe, test, expect, beforeAll, afterAll, beforeEach, jest} from '@jest/globals'
import {FileStatus} from '../../../src/types/enums'

// Test helpers
import {createFilesTable, deleteFilesTable, insertFile} from '../helpers/dynamodb-helpers'
import {createMockContext} from '../helpers/lambda-context'

// Test configuration
const TEST_TABLE = 'test-files'

// Set environment variables for Lambda
process.env.DynamoDBTableFiles = TEST_TABLE
process.env.USE_LOCALSTACK = 'true'

describe('FileCoordinator Workflow Integration Tests', () => {
  let handler: any
  let mockContext: any
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

    // Mock Lambda invocation (don't actually invoke StartFileUpload)
    invokeLambdaMock = jest.fn<() => Promise<{StatusCode: number}>>().mockResolvedValue({StatusCode: 202})

    jest.unstable_mockModule('../../../src/lib/vendor/AWS/Lambda', () => ({
      invokeLambda: invokeLambdaMock,
      invokeAsync: invokeLambdaMock
    }))

    // Import handler AFTER mocks are set up
    const module = await import('../../../src/lambdas/FileCoordinator/src/index')
    handler = module.handler
  })

  test('should fan-out to multiple StartFileUpload invocations for pending files', async () => {
    // Arrange: Insert 3 pending files ready to download
    const now = Date.now()
    const fileIds = ['video-1', 'video-2', 'video-3']

    await Promise.all(
      fileIds.map((fileId) =>
        insertFile({
          fileId,
          status: FileStatus.PendingMetadata,
          availableAt: now - 1000, // Available 1 second ago
          title: `Test Video ${fileId}`
        })
      )
    )

    // Create mock scheduled event
    const event = {
      'detail-type': 'Scheduled Event',
      source: 'aws.events',
      time: new Date().toISOString(),
      region: 'us-west-2',
      resources: ['arn:aws:events:us-west-2:123456789012:rule/FileCoordinatorSchedule'],
      detail: {}
    }

    // Act: Invoke FileCoordinator handler
    const result = await handler(event, mockContext)

    // Assert: Lambda response is successful
    expect(result.statusCode).toBe(200)

    // Assert: StartFileUpload was invoked for each file
    expect(invokeLambdaMock).toHaveBeenCalledTimes(3)

    // Verify each file was invoked with correct payload
    const invocationPayloads = invokeLambdaMock.mock.calls.map((call) => JSON.parse(call[1] as string))
    const invokedFileIds = invocationPayloads.map((payload) => payload.fileId).sort()

    expect(invokedFileIds).toEqual(fileIds.sort())
  })

  test('should handle empty queue gracefully without any Lambda invocations', async () => {
    // Arrange: No pending files in the database
    const event = {
      'detail-type': 'Scheduled Event',
      source: 'aws.events',
      time: new Date().toISOString(),
      region: 'us-west-2',
      resources: ['arn:aws:events:us-west-2:123456789012:rule/FileCoordinatorSchedule'],
      detail: {}
    }

    // Act: Invoke FileCoordinator handler
    const result = await handler(event, mockContext)

    // Assert: Lambda response is successful
    expect(result.statusCode).toBe(200)

    // Assert: No StartFileUpload invocations
    expect(invokeLambdaMock).not.toHaveBeenCalled()
  })

  test('should only process files with availableAt <= now', async () => {
    // Arrange: Insert files with various availableAt times
    const now = Date.now()

    await insertFile({
      fileId: 'past-video',
      status: FileStatus.PendingMetadata,
      availableAt: now - 10000, // 10 seconds ago
      title: 'Past Video'
    })

    await insertFile({
      fileId: 'future-video',
      status: FileStatus.PendingMetadata,
      availableAt: now + 86400000, // 24 hours in future
      title: 'Future Video'
    })

    await insertFile({
      fileId: 'now-video',
      status: FileStatus.PendingMetadata,
      availableAt: now, // Exactly now
      title: 'Now Video'
    })

    const event = {
      'detail-type': 'Scheduled Event',
      source: 'aws.events',
      time: new Date().toISOString(),
      region: 'us-west-2',
      resources: ['arn:aws:events:us-west-2:123456789012:rule/FileCoordinatorSchedule'],
      detail: {}
    }

    // Act: Invoke FileCoordinator
    const result = await handler(event, mockContext)

    // Assert: Successful response
    expect(result.statusCode).toBe(200)

    // Assert: Only 2 files processed (past-video and now-video)
    expect(invokeLambdaMock).toHaveBeenCalledTimes(2)

    const invocationPayloads = invokeLambdaMock.mock.calls.map((call) => JSON.parse(call[1] as string))
    const invokedFileIds = invocationPayloads.map((payload) => payload.fileId).sort()

    expect(invokedFileIds).toEqual(['now-video', 'past-video'])
  })

  test('should skip files that already have url attribute (already downloaded)', async () => {
    // Arrange: Insert mix of pending and downloaded files
    const now = Date.now()

    await insertFile({
      fileId: 'pending-video',
      status: FileStatus.PendingMetadata,
      availableAt: now - 1000,
      title: 'Pending Video'
    })

    await insertFile({
      fileId: 'downloaded-video',
      status: FileStatus.Downloaded,
      availableAt: now - 1000,
      title: 'Downloaded Video',
      key: 'downloaded-video.mp4',
      size: 5242880
    })

    // Manually update the downloaded file with url attribute
    // (In production this would be set by StartFileUpload)
    const {updateItem} = await import('../../../src/lib/vendor/AWS/DynamoDB')
    await updateItem({
      TableName: TEST_TABLE,
      Key: {fileId: {S: 'downloaded-video'}},
      UpdateExpression: 'SET #url = :url',
      ExpressionAttributeNames: {'#url': 'url'},
      ExpressionAttributeValues: {':url': {S: 'https://s3.amazonaws.com/bucket/downloaded-video.mp4'}}
    })

    const event = {
      'detail-type': 'Scheduled Event',
      source: 'aws.events',
      time: new Date().toISOString(),
      region: 'us-west-2',
      resources: ['arn:aws:events:us-west-2:123456789012:rule/FileCoordinatorSchedule'],
      detail: {}
    }

    // Act: Invoke FileCoordinator
    const result = await handler(event, mockContext)

    // Assert: Successful response
    expect(result.statusCode).toBe(200)

    // Assert: Only 1 file processed (pending-video)
    expect(invokeLambdaMock).toHaveBeenCalledTimes(1)

    const invocationPayload = JSON.parse(invokeLambdaMock.mock.calls[0][1] as string)
    expect(invocationPayload.fileId).toBe('pending-video')
  })

  test('should handle concurrent execution without conflicts', async () => {
    // Arrange: Insert multiple files
    const now = Date.now()
    const fileIds = ['concurrent-1', 'concurrent-2', 'concurrent-3', 'concurrent-4', 'concurrent-5']

    await Promise.all(
      fileIds.map((fileId) =>
        insertFile({
          fileId,
          status: FileStatus.PendingMetadata,
          availableAt: now - 1000,
          title: `Concurrent Video ${fileId}`
        })
      )
    )

    const event = {
      'detail-type': 'Scheduled Event',
      source: 'aws.events',
      time: new Date().toISOString(),
      region: 'us-west-2',
      resources: ['arn:aws:events:us-west-2:123456789012:rule/FileCoordinatorSchedule'],
      detail: {}
    }

    // Act: Invoke FileCoordinator twice concurrently (simulating overlapping scheduled runs)
    const [result1, result2] = await Promise.all([handler(event, mockContext), handler(event, mockContext)])

    // Assert: Both invocations successful
    expect(result1.statusCode).toBe(200)
    expect(result2.statusCode).toBe(200)

    // Assert: Both invocations found all 5 files (idempotent scan)
    // Each invocation should have triggered 5 Lambda calls
    expect(invokeLambdaMock).toHaveBeenCalledTimes(10) // 5 files × 2 invocations

    // Note: In production, StartFileUpload handles deduplication via DynamoDB
    // conditional updates. This test verifies FileCoordinator's scan is safe.
  })
})
