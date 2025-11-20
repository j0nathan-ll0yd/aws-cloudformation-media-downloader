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

// Test configuration
const TEST_FILES_TABLE = 'test-files-list'
const TEST_USER_FILES_TABLE = 'test-user-files-list'

// Set environment variables for Lambda
process.env.DynamoDBTableFiles = TEST_FILES_TABLE
process.env.DynamoDBTableUserFiles = TEST_USER_FILES_TABLE
process.env.USE_LOCALSTACK = 'true'

import {describe, test, expect, beforeAll, afterAll, beforeEach, jest} from '@jest/globals'
import {FileStatus, UserStatus} from '../../../src/types/enums'

// Test helpers
import {createFilesTable, deleteFilesTable} from '../helpers/dynamodb-helpers'
import {createMockContext} from '../helpers/lambda-context'

import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'
import {CustomAPIGatewayRequestAuthorizerEvent} from '../../../src/types/main'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dynamodbModulePath = resolve(__dirname, '../../../src/lib/vendor/AWS/DynamoDB')

const queryMock = jest.fn<() => Promise<{Items?: unknown[]}>>()
const batchGetMock = jest.fn<() => Promise<{Responses?: Record<string, unknown[]>}>>()
jest.unstable_mockModule(dynamodbModulePath, () => ({
  query: queryMock,
  batchGet: batchGetMock,
  updateItem: jest.fn(),
  scan: jest.fn()
}))

const {handler} = await import('../../../src/lambdas/ListFiles/src/index')

type BatchGetCallArgs = [{RequestItems: Record<string, {Keys: unknown[]}>}]

function createListFilesEvent(userId: string | undefined, userStatus: UserStatus): CustomAPIGatewayRequestAuthorizerEvent {
  return {
    body: null,
    headers: userId && userStatus === UserStatus.Authenticated ? {'Authorization': 'Bearer test-token'} : userStatus === UserStatus.Unauthenticated ? {'Authorization': 'Bearer invalid-token'} : {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/files',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      path: '/files',
      stage: 'test',
      requestId: 'test-request',
      requestTime: '01/Jan/2024:00:00:00 +0000',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/files',
      authorizer: {
        principalId: userStatus === UserStatus.Unauthenticated ? 'unknown' : userId || 'anonymous',
        userId,
        userStatus,
        integrationLatency: 342
      },
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent'
      }
    },
    resource: '/files'
  } as unknown as CustomAPIGatewayRequestAuthorizerEvent
}

describe('ListFiles Workflow Integration Tests', () => {
  let mockContext: any

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

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks()
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

    const event = createListFilesEvent('user-abc-123', UserStatus.Authenticated)

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(2)
    expect(response.body.contents).toHaveLength(2)
    expect(response.body.contents[0].fileId).toBe('video-1')
    expect(response.body.contents[1].fileId).toBe('video-2')

    expect(queryMock).toHaveBeenCalledTimes(1)

    expect(batchGetMock).toHaveBeenCalledTimes(1)
    const batchGetParams = (batchGetMock.mock.calls as unknown as BatchGetCallArgs[])[0][0]
    expect(batchGetParams.RequestItems[TEST_FILES_TABLE].Keys).toHaveLength(3)
  })

  test('should return empty list when user has no files', async () => {
    queryMock.mockResolvedValueOnce({
      Items: []
    })

    const event = createListFilesEvent('user-no-files', UserStatus.Authenticated)

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)
    expect(response.body.keyCount).toBe(0)
    expect(response.body.contents).toHaveLength(0)

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(batchGetMock).not.toHaveBeenCalled()
  })

  test('should return demo file for anonymous user without querying DynamoDB', async () => {
    const event = createListFilesEvent(undefined, UserStatus.Anonymous)

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(1)
    expect(response.body.contents).toHaveLength(1)
    expect(response.body.contents[0]).toHaveProperty('fileId')

    expect(queryMock).not.toHaveBeenCalled()
    expect(batchGetMock).not.toHaveBeenCalled()
  })

  test('should return 401 for unauthenticated user', async () => {
    const event = createListFilesEvent(undefined, UserStatus.Unauthenticated)

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(401)

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

    const event = createListFilesEvent('user-mixed-files', UserStatus.Authenticated)

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(2)
    expect(response.body.contents).toHaveLength(2)
    expect(response.body.contents[0].status).toBe(FileStatus.Downloaded)
    expect(response.body.contents[1].status).toBe(FileStatus.Downloaded)

    const fileIds = response.body.contents.map((file: any) => file.fileId).sort()
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

    const event = createListFilesEvent('user-many-files', UserStatus.Authenticated)

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(25)
    expect(response.body.contents).toHaveLength(25)
    expect(response.body.contents.every((file: any) => file.status === FileStatus.Downloaded)).toBe(true)
  })

  test('should handle DynamoDB errors gracefully', async () => {
    queryMock.mockRejectedValueOnce(new Error('DynamoDB service unavailable'))

    const event = createListFilesEvent('user-error', UserStatus.Authenticated)

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(500)

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(batchGetMock).not.toHaveBeenCalled()
  })
})
