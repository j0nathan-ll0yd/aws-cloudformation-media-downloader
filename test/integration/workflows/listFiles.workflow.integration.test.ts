/**
 * ListFiles Workflow Integration Tests
 *
 * Tests the file listing workflow against LocalStack:
 * 1. Extract userId and userStatus from event (custom authorizer)
 * 2. Handle different user statuses (Authenticated, Anonymous, Unauthenticated)
 * 3. Query DynamoDB UserFiles table for user's file IDs
 * 4. BatchGet files from Files table
 * 5. Filter to only Downloaded files
 * 6. Return file list to client
 *
 * This tests YOUR orchestration logic, not AWS SDK behavior.
 */

import {describe, test, expect, beforeAll, afterAll, beforeEach, jest} from '@jest/globals'
import {FileStatus, UserStatus} from '../../../src/types/enums'

// Test helpers
import {createFilesTable, deleteFilesTable} from '../helpers/dynamodb-helpers'
import {createMockContext} from '../helpers/lambda-context'

// Test configuration
const TEST_FILES_TABLE = 'test-files'
const TEST_USER_FILES_TABLE = 'test-user-files'

// Set environment variables for Lambda
process.env.DynamoDBTableFiles = TEST_FILES_TABLE
process.env.DynamoDBTableUserFiles = TEST_USER_FILES_TABLE
process.env.USE_LOCALSTACK = 'true'

describe('ListFiles Workflow Integration Tests', () => {
  let handler: any
  let mockContext: any
  let queryMock: jest.Mock
  let batchGetMock: jest.Mock

  beforeAll(async () => {
    // Create LocalStack infrastructure
    await createFilesTable()

    // Wait for tables to be ready
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

    // Mock DynamoDB query and batchGet
    queryMock = jest.fn()
    batchGetMock = jest.fn()

    jest.unstable_mockModule('../../../src/lib/vendor/AWS/DynamoDB', () => ({
      query: queryMock,
      batchGet: batchGetMock,
      updateItem: jest.fn(),
      scan: jest.fn()
    }))

    // Import handler AFTER mocks are set up
    const module = await import('../../../src/lambdas/ListFiles/src/index')
    handler = module.handler
  })

  test('should query UserFiles and return Downloaded files for authenticated user', async () => {
    // Arrange: Mock DynamoDB responses
    // First query: getUserFilesParams returns file IDs
    queryMock.mockResolvedValueOnce({
      Items: [
        {fileId: 'video-1'},
        {fileId: 'video-2'},
        {fileId: 'video-3'}
      ]
    })

    // BatchGet: getFilesById returns file details
    batchGetMock.mockResolvedValueOnce({
      Responses: {
        [TEST_FILES_TABLE]: [
          {
            fileId: 'video-1',
            status: FileStatus.Downloaded,
            title: 'Video 1',
            key: 'video-1.mp4',
            size: 5242880
          },
          {
            fileId: 'video-2',
            status: FileStatus.Downloaded,
            title: 'Video 2',
            key: 'video-2.mp4',
            size: 10485760
          },
          {
            fileId: 'video-3',
            status: FileStatus.PendingDownload,
            title: 'Video 3 (not ready)',
            key: undefined,
            size: undefined
          }
        ]
      }
    })

    // API Gateway event with authenticated user
    const event = {
      requestContext: {
        authorizer: {
          userId: 'user-abc-123',
          userStatus: UserStatus.Authenticated
        }
      }
    }

    // Act: Invoke ListFiles handler
    const result = await handler(event, mockContext)

    // Assert: Successful response
    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)

    // Assert: Only Downloaded files returned (video-3 filtered out)
    expect(body.keyCount).toBe(2)
    expect(body.contents).toHaveLength(2)
    expect(body.contents[0].fileId).toBe('video-1')
    expect(body.contents[1].fileId).toBe('video-2')

    // Assert: DynamoDB query called for UserFiles
    expect(queryMock).toHaveBeenCalledTimes(1)
    const queryParams = queryMock.mock.calls[0][0] as {TableName: string}
    expect(queryParams.TableName).toBe(TEST_USER_FILES_TABLE)

    // Assert: BatchGet called for Files
    expect(batchGetMock).toHaveBeenCalledTimes(1)
    const batchGetParams = batchGetMock.mock.calls[0][0] as any
    expect(batchGetParams.RequestItems[TEST_FILES_TABLE].Keys).toHaveLength(3)
  })

  test('should return empty list when user has no files', async () => {
    // Arrange: Mock DynamoDB to return empty UserFiles
    queryMock.mockResolvedValueOnce({
      Items: []
    })

    const event = {
      requestContext: {
        authorizer: {
          userId: 'user-no-files',
          userStatus: UserStatus.Authenticated
        }
      }
    }

    // Act: Invoke handler
    const result = await handler(event, mockContext)

    // Assert: Successful response with empty list
    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.keyCount).toBe(0)
    expect(body.contents).toHaveLength(0)

    // Assert: Only UserFiles query (no BatchGet)
    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(batchGetMock).not.toHaveBeenCalled()
  })

  test('should return demo file for anonymous user without querying DynamoDB', async () => {
    // Arrange: Anonymous user event
    const event = {
      requestContext: {
        authorizer: {
          userId: undefined,
          userStatus: UserStatus.Anonymous
        }
      }
    }

    // Act: Invoke handler
    const result = await handler(event, mockContext)

    // Assert: Successful response
    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)

    // Assert: Demo file returned
    expect(body.keyCount).toBe(1)
    expect(body.contents).toHaveLength(1)
    expect(body.contents[0]).toHaveProperty('fileId')

    // Assert: No DynamoDB queries (anonymous user)
    expect(queryMock).not.toHaveBeenCalled()
    expect(batchGetMock).not.toHaveBeenCalled()
  })

  test('should return 401 for unauthenticated user', async () => {
    // Arrange: Unauthenticated user event
    const event = {
      requestContext: {
        authorizer: {
          userId: undefined,
          userStatus: UserStatus.Unauthenticated
        }
      }
    }

    // Act: Invoke handler
    const result = await handler(event, mockContext)

    // Assert: Unauthorized response
    expect(result.statusCode).toBe(401)

    // Assert: No DynamoDB queries
    expect(queryMock).not.toHaveBeenCalled()
    expect(batchGetMock).not.toHaveBeenCalled()
  })

  test('should filter out non-Downloaded files (Pending, Failed, PendingDownload)', async () => {
    // Arrange: Mock DynamoDB responses with mixed file statuses
    queryMock.mockResolvedValueOnce({
      Items: [
        {fileId: 'downloaded-1'},
        {fileId: 'downloaded-2'},
        {fileId: 'pending-1'},
        {fileId: 'failed-1'},
        {fileId: 'pending-download-1'}
      ]
    })

    batchGetMock.mockResolvedValueOnce({
      Responses: {
        [TEST_FILES_TABLE]: [
          {fileId: 'downloaded-1', status: FileStatus.Downloaded, title: 'Downloaded 1', key: 'downloaded-1.mp4'},
          {fileId: 'downloaded-2', status: FileStatus.Downloaded, title: 'Downloaded 2', key: 'downloaded-2.mp4'},
          {fileId: 'pending-1', status: FileStatus.PendingMetadata, title: 'Pending 1'},
          {fileId: 'failed-1', status: FileStatus.Failed, title: 'Failed 1'},
          {fileId: 'pending-download-1', status: FileStatus.PendingDownload, title: 'Pending Download 1'}
        ]
      }
    })

    const event = {
      requestContext: {
        authorizer: {
          userId: 'user-mixed-files',
          userStatus: UserStatus.Authenticated
        }
      }
    }

    // Act: Invoke handler
    const result = await handler(event, mockContext)

    // Assert: Successful response
    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)

    // Assert: Only Downloaded files returned
    expect(body.keyCount).toBe(2)
    expect(body.contents).toHaveLength(2)
    expect(body.contents[0].status).toBe(FileStatus.Downloaded)
    expect(body.contents[1].status).toBe(FileStatus.Downloaded)

    // Verify specific files
    const fileIds = body.contents.map((file: any) => file.fileId).sort()
    expect(fileIds).toEqual(['downloaded-1', 'downloaded-2'])
  })

  test('should handle large batch of files efficiently', async () => {
    // Arrange: Mock DynamoDB with 50 files
    const fileIds = Array.from({length: 50}, (_, i) => `video-${i}`)

    queryMock.mockResolvedValueOnce({
      Items: fileIds.map((fileId) => ({fileId}))
    })

    const files = fileIds.map((fileId, index) => ({
      fileId,
      status: index % 2 === 0 ? FileStatus.Downloaded : FileStatus.PendingDownload,
      title: `Video ${index}`,
      key: index % 2 === 0 ? `${fileId}.mp4` : undefined,
      size: index % 2 === 0 ? 5242880 : undefined
    }))

    batchGetMock.mockResolvedValueOnce({
      Responses: {
        [TEST_FILES_TABLE]: files
      }
    })

    const event = {
      requestContext: {
        authorizer: {
          userId: 'user-many-files',
          userStatus: UserStatus.Authenticated
        }
      }
    }

    // Act: Invoke handler
    const result = await handler(event, mockContext)

    // Assert: Successful response
    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)

    // Assert: Only Downloaded files returned (25 out of 50)
    expect(body.keyCount).toBe(25)
    expect(body.contents).toHaveLength(25)
    expect(body.contents.every((file: any) => file.status === FileStatus.Downloaded)).toBe(true)
  })

  test('should handle DynamoDB errors gracefully', async () => {
    // Arrange: Mock DynamoDB query to fail
    queryMock.mockRejectedValueOnce(new Error('DynamoDB service unavailable'))

    const event = {
      requestContext: {
        authorizer: {
          userId: 'user-error',
          userStatus: UserStatus.Authenticated
        }
      }
    }

    // Act: Invoke handler
    const result = await handler(event, mockContext)

    // Assert: Error response returned
    expect(result.statusCode).toBe(500)

    // Assert: Query was attempted
    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(batchGetMock).not.toHaveBeenCalled()
  })
})
