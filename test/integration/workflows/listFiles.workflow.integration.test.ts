/**
 * ListFiles Workflow Integration Tests
 *
 * Tests the file listing workflow with REAL PostgreSQL:
 * - Entity queries: Real Drizzle queries via getDrizzleClient()
 *
 * Workflow:
 * 1. Extract userId and userStatus from event (custom authorizer)
 * 2. Handle different user statuses (Authenticated, Anonymous, Unauthenticated)
 * 3. Query files for user via real database JOIN
 * 4. Filter to only Downloaded files
 * 5. Return file list to client
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'
process.env.DEFAULT_FILE_SIZE = '1024'
process.env.DEFAULT_FILE_NAME = 'test-default-file.mp4'
process.env.DEFAULT_FILE_URL = 'https://example.com/test-default-file.mp4'
process.env.DEFAULT_FILE_CONTENT_TYPE = 'video/mp4'

import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'
import type {Context} from 'aws-lambda'
import {FileStatus, UserStatus} from '#types/enums'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'

// Test helpers
import {createMockContext} from '../helpers/lambda-context'
import {closeTestDb, createAllTables, getTestDbAsync, insertFile, insertUser, linkUserFile, truncateAllTables} from '../helpers/postgres-helpers'

// Import handler - uses real Drizzle client via getDrizzleClient()
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

  beforeAll(async () => {
    await getTestDbAsync()
    await createAllTables()
    mockContext = createMockContext()
  })

  afterEach(async () => {
    await truncateAllTables()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  test('should query and return Downloaded files for authenticated user', async () => {
    // Arrange: Create user and files in real database
    const userId = crypto.randomUUID()
    await insertUser({userId, email: 'listfiles@example.com'})

    await insertFile({fileId: 'video-1', key: 'video-1.mp4', status: FileStatus.Downloaded, title: 'Video 1', publishDate: '2024-01-03T00:00:00.000Z'})
    await insertFile({
      fileId: 'video-2',
      key: 'video-2.mp4',
      status: FileStatus.Downloaded,
      title: 'Video 2',
      size: 10485760,
      publishDate: '2024-01-02T00:00:00.000Z'
    })

    await linkUserFile(userId, 'video-1')
    await linkUserFile(userId, 'video-2')

    // Act
    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(2)
    expect(response.body.contents).toHaveLength(2)
  })

  test('should return empty list when user has no files', async () => {
    // Arrange: Create user with no files
    const userId = crypto.randomUUID()
    await insertUser({userId, email: 'nofiles@example.com'})

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
    // Act: Anonymous user (no userId) - doesn't need database setup
    const event = createListFilesEvent(undefined, UserStatus.Anonymous)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(1)
    expect(response.body.contents).toHaveLength(1)
    expect(response.body.contents[0]).toHaveProperty('fileId')
  })

  test('should return 401 for unauthenticated user', async () => {
    // Act
    const event = createListFilesEvent(undefined, UserStatus.Unauthenticated)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(401)
  })

  test('should filter out non-Downloaded files', async () => {
    // Arrange: Create user with mix of file statuses
    const userId = crypto.randomUUID()
    await insertUser({userId, email: 'mixed@example.com'})

    // Create files with different statuses
    await insertFile({fileId: 'downloaded-1', key: 'downloaded-1.mp4', status: FileStatus.Downloaded, title: 'Downloaded 1'})
    await insertFile({fileId: 'downloaded-2', key: 'downloaded-2.mp4', status: FileStatus.Downloaded, title: 'Downloaded 2'})
    await insertFile({fileId: 'queued-1', key: 'queued-1.mp4', status: FileStatus.Queued, title: 'Queued 1'})
    await insertFile({fileId: 'downloading-1', key: 'downloading-1.mp4', status: FileStatus.Downloading, title: 'Downloading 1'})

    // Link all files to user
    await linkUserFile(userId, 'downloaded-1')
    await linkUserFile(userId, 'downloaded-2')
    await linkUserFile(userId, 'queued-1')
    await linkUserFile(userId, 'downloading-1')

    // Act
    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    // Assert - only Downloaded files should be returned
    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(2)
    expect(response.body.contents).toHaveLength(2)
    expect(response.body.contents.every((f: {status: string}) => f.status === FileStatus.Downloaded)).toBe(true)
  })

  test('should handle large batch of files efficiently', async () => {
    // Arrange: Create user with 25 Downloaded files
    const userId = crypto.randomUUID()
    await insertUser({userId, email: 'batch@example.com'})

    for (let i = 0; i < 25; i++) {
      const fileId = `video-batch-${i}`
      await insertFile({fileId, key: `${fileId}.mp4`, status: FileStatus.Downloaded, title: `Video ${i}`})
      await linkUserFile(userId, fileId)
    }

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
    // Arrange: Create user and file with full metadata
    const userId = crypto.randomUUID()
    await insertUser({userId, email: 'metadata@example.com'})

    await insertFile({
      fileId: 'full-metadata',
      key: 'full-metadata.mp4',
      status: FileStatus.Downloaded,
      title: 'Full Metadata Video',
      authorName: 'Test Channel',
      authorUser: 'testchannel',
      description: 'A video with full metadata',
      size: 10485760,
      url: 'https://cdn.example.com/video.mp4',
      contentType: 'video/mp4',
      publishDate: '2024-01-15T12:00:00.000Z'
    })

    await linkUserFile(userId, 'full-metadata')

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
    // Arrange: Create user with only Queued files (no Downloaded)
    const userId = crypto.randomUUID()
    await insertUser({userId, email: 'queued-only@example.com'})

    await insertFile({fileId: 'queued-only', key: 'queued-only.mp4', status: FileStatus.Queued, title: 'Queued Only'})
    await linkUserFile(userId, 'queued-only')

    // Act
    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    // Assert - no Downloaded files means empty response
    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(0)
    expect(response.body.contents).toHaveLength(0)
  })
})
