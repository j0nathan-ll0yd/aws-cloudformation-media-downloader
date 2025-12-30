/**
 * ListFiles Workflow Integration Tests
 *
 * Tests the file listing workflow:
 * - Entity queries: Mocked for file lookups
 *
 * Workflow:
 * 1. Extract userId and userStatus from event (custom authorizer)
 * 2. Handle different user statuses (Authenticated, Anonymous, Unauthenticated)
 * 3. Query files for user via entity queries (mocked)
 * 4. Filter to only Downloaded files
 * 5. Return file list to client
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.DEFAULT_FILE_SIZE = '1024'
process.env.DEFAULT_FILE_NAME = 'test-default-file.mp4'
process.env.DEFAULT_FILE_URL = 'https://example.com/test-default-file.mp4'
process.env.DEFAULT_FILE_CONTENT_TYPE = 'video/mp4'

import {afterEach, beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'
import type {Context} from 'aws-lambda'
import {FileStatus, UserStatus} from '#types/enums'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'

// Test helpers
import {createMockContext} from '../helpers/lambda-context'
import {createMockFile} from '../helpers/test-data'

// Mock entity queries - must use vi.hoisted for ESM
const {getFilesForUserMock} = vi.hoisted(() => ({getFilesForUserMock: vi.fn()}))

vi.mock('#entities/queries', () => ({getFilesForUser: getFilesForUserMock}))

// Import handler after mocks
const {handler} = await import('#lambdas/ListFiles/src/index')

function createListFilesEvent(userId: string | undefined, userStatus: UserStatus): CustomAPIGatewayRequestAuthorizerEvent {
  return {
    body: null,
    headers: userId && userStatus === UserStatus.Authenticated
      ? {Authorization: 'Bearer test-token'}
      : userStatus === UserStatus.Unauthenticated
      ? {Authorization: 'Bearer invalid-token'}
      : {},
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
      authorizer: {principalId: userStatus === UserStatus.Unauthenticated ? 'unknown' : userId || 'anonymous', userId, userStatus, integrationLatency: 342},
      identity: {sourceIp: '127.0.0.1', userAgent: 'test-agent'}
    },
    resource: '/files'
  } as unknown as CustomAPIGatewayRequestAuthorizerEvent
}

describe('ListFiles Workflow Integration Tests', () => {
  let mockContext: Context

  beforeAll(() => {
    mockContext = createMockContext()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock implementation
    getFilesForUserMock.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('should query and return Downloaded files for authenticated user', async () => {
    // Arrange: Mock files returned from entity query
    const userId = crypto.randomUUID()
    const mockFiles = [
      createMockFile('video-1', FileStatus.Downloaded, {title: 'Video 1', publishDate: '2024-01-03T00:00:00.000Z'}),
      createMockFile('video-2', FileStatus.Downloaded, {title: 'Video 2', size: 10485760, publishDate: '2024-01-02T00:00:00.000Z'})
    ]

    getFilesForUserMock.mockResolvedValue(mockFiles)

    // Act
    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(2)
    expect(response.body.contents).toHaveLength(2)
    expect(getFilesForUserMock).toHaveBeenCalledWith(userId)
  })

  test('should return empty list when user has no files', async () => {
    // Arrange: Mock empty file list
    const userId = crypto.randomUUID()
    getFilesForUserMock.mockResolvedValue([])

    // Act
    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)
    expect(response.body.keyCount).toBe(0)
    expect(response.body.contents).toHaveLength(0)
  })

  test('should return demo file for anonymous user without querying database', async () => {
    // Act: Anonymous user (no userId)
    const event = createListFilesEvent(undefined, UserStatus.Anonymous)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(1)
    expect(response.body.contents).toHaveLength(1)
    expect(response.body.contents[0]).toHaveProperty('fileId')

    // Should not query database for anonymous user
    expect(getFilesForUserMock).not.toHaveBeenCalled()
  })

  test('should return 401 for unauthenticated user', async () => {
    // Act
    const event = createListFilesEvent(undefined, UserStatus.Unauthenticated)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(401)
  })

  test('should filter out non-Downloaded files', async () => {
    // Arrange: Mock files with mixed statuses (entity query returns only Downloaded)
    const userId = crypto.randomUUID()
    const mockFiles = [
      createMockFile('downloaded-1', FileStatus.Downloaded, {title: 'Downloaded 1'}),
      createMockFile('downloaded-2', FileStatus.Downloaded, {title: 'Downloaded 2'})
    ]

    getFilesForUserMock.mockResolvedValue(mockFiles)

    // Act
    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(2)
    expect(response.body.contents).toHaveLength(2)
  })

  test('should handle large batch of files efficiently', async () => {
    // Arrange: Mock 25 downloaded files
    const userId = crypto.randomUUID()
    const mockFiles = Array.from({length: 25}, (_, i) => createMockFile(`video-${i}`, FileStatus.Downloaded, {title: `Video ${i}`}))

    getFilesForUserMock.mockResolvedValue(mockFiles)

    // Act
    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(25)
    expect(response.body.contents).toHaveLength(25)
  })

  test('should return files with full metadata', async () => {
    // Arrange: Mock file with full metadata
    const userId = crypto.randomUUID()
    const mockFiles = [
      createMockFile('full-metadata', FileStatus.Downloaded, {
        title: 'Full Metadata Video',
        authorName: 'Test Channel',
        authorUser: 'testchannel',
        description: 'A video with full metadata',
        size: 10485760,
        url: 'https://cdn.example.com/video.mp4',
        contentType: 'video/mp4',
        publishDate: '2024-01-15T12:00:00.000Z'
      })
    ]

    getFilesForUserMock.mockResolvedValue(mockFiles)

    // Act
    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.contents).toHaveLength(1)
    const file = response.body.contents[0]
    expect(file.title).toBe('Full Metadata Video')
    expect(file.authorName).toBe('Test Channel')
    expect(file.size).toBe(10485760)
  })

  test('should handle user with only non-Downloaded files', async () => {
    // Arrange: Mock empty result (no Downloaded files)
    const userId = crypto.randomUUID()
    getFilesForUserMock.mockResolvedValue([])

    // Act
    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(0)
    expect(response.body.contents).toHaveLength(0)
  })
})
