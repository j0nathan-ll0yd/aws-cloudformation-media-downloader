/**
 * ListFiles Workflow Integration Tests
 *
 * Tests the file listing workflow against real services:
 * - PostgreSQL: User, File, and UserFile records
 *
 * Workflow:
 * 1. Extract userId and userStatus from event (custom authorizer)
 * 2. Handle different user statuses (Authenticated, Anonymous, Unauthenticated)
 * 3. Query PostgreSQL UserFiles table for user's file IDs
 * 4. Query PostgreSQL Files table for file details
 * 5. Filter to only Downloaded files
 * 6. Return file list to client
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
import type {File} from '#types/domain-models'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'

// Test helpers
import {closeTestDb, createAllTables, dropAllTables, insertFile, insertUser, linkUserFile, truncateAllTables} from '../helpers/postgres-helpers'
import {createMockContext} from '../helpers/lambda-context'

// Import handler directly (no mocking - uses real services)
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

// Skip in CI: Handler uses own Drizzle connection that doesn't respect worker schema isolation
describe.skipIf(Boolean(process.env.CI))('ListFiles Workflow Integration Tests', () => {
  let mockContext: Context

  beforeAll(async () => {
    // Create PostgreSQL tables
    await createAllTables()
    mockContext = createMockContext()
  })

  afterEach(async () => {
    // Clean up data between tests
    await truncateAllTables()
  })

  afterAll(async () => {
    // Drop tables and close connection
    await dropAllTables()
    await closeTestDb()
  })

  test('should query PostgreSQL and return Downloaded files for authenticated user', async () => {
    // Arrange: Create user with files in PostgreSQL
    const userId = crypto.randomUUID()

    await insertUser({userId, email: 'listfiles@example.com', firstName: 'ListFiles'})

    // Create files with different statuses
    await insertFile({fileId: 'video-1', status: FileStatus.Downloaded, title: 'Video 1', publishDate: '2024-01-03T00:00:00.000Z'})
    await insertFile({fileId: 'video-2', status: FileStatus.Downloaded, title: 'Video 2', size: 10485760, publishDate: '2024-01-02T00:00:00.000Z'})
    await insertFile({fileId: 'video-3', status: FileStatus.Queued, title: 'Video 3 (not ready)'})

    // Link all files to user
    await linkUserFile(userId, 'video-1')
    await linkUserFile(userId, 'video-2')
    await linkUserFile(userId, 'video-3')

    // Act
    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    // Only Downloaded files should be returned (2 of 3)
    expect(response.body.keyCount).toBe(2)
    expect(response.body.contents).toHaveLength(2)

    // Files should be sorted by publishDate descending
    expect(response.body.contents[0].fileId).toBe('video-1')
    expect(response.body.contents[1].fileId).toBe('video-2')
  })

  test('should return empty list when user has no files', async () => {
    // Arrange: Create user without files
    const userId = crypto.randomUUID()
    await insertUser({userId, email: 'nofiles@example.com', firstName: 'NoFiles'})

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
  })

  test('should return 401 for unauthenticated user', async () => {
    // Act
    const event = createListFilesEvent(undefined, UserStatus.Unauthenticated)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(401)
  })

  test('should filter out non-Downloaded files', async () => {
    // Arrange: Create user with mixed file statuses
    const userId = crypto.randomUUID()

    await insertUser({userId, email: 'mixedfiles@example.com', firstName: 'MixedFiles'})

    await insertFile({fileId: 'downloaded-1', status: FileStatus.Downloaded, title: 'Downloaded 1'})
    await insertFile({fileId: 'downloaded-2', status: FileStatus.Downloaded, title: 'Downloaded 2'})
    await insertFile({fileId: 'queued-1', status: FileStatus.Queued, title: 'Queued 1'})
    await insertFile({fileId: 'failed-1', status: FileStatus.Failed, title: 'Failed 1'})
    await insertFile({fileId: 'downloading-1', status: FileStatus.Downloading, title: 'Downloading 1'})

    await linkUserFile(userId, 'downloaded-1')
    await linkUserFile(userId, 'downloaded-2')
    await linkUserFile(userId, 'queued-1')
    await linkUserFile(userId, 'failed-1')
    await linkUserFile(userId, 'downloading-1')

    // Act
    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(2)
    expect(response.body.contents).toHaveLength(2)
    expect(response.body.contents.every((file: Partial<File>) => file.status === FileStatus.Downloaded)).toBe(true)

    const fileIds = response.body.contents.map((file: Partial<File>) => file.fileId).sort()
    expect(fileIds).toEqual(['downloaded-1', 'downloaded-2'])
  })

  test('should handle large batch of files efficiently', async () => {
    // Arrange: Create user with 50 files
    const userId = crypto.randomUUID()
    const fileIds = Array.from({length: 50}, (_, i) => `video-${i}`)

    await insertUser({userId, email: 'manyfiles@example.com', firstName: 'ManyFiles'})

    for (let i = 0; i < fileIds.length; i++) {
      const fileId = fileIds[i]
      const status = i % 2 === 0 ? FileStatus.Downloaded : FileStatus.Queued
      await insertFile({fileId, status, title: `Video ${i}`})
      await linkUserFile(userId, fileId)
    }

    // Act
    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    // Only Downloaded files (25 of 50)
    expect(response.body.keyCount).toBe(25)
    expect(response.body.contents).toHaveLength(25)
    expect(response.body.contents.every((file: Partial<File>) => file.status === FileStatus.Downloaded)).toBe(true)
  })

  test('should return files with full metadata', async () => {
    // Arrange: Create user with file containing full metadata
    const userId = crypto.randomUUID()

    await insertUser({userId, email: 'metadata@example.com', firstName: 'Metadata'})

    await insertFile({
      fileId: 'full-metadata',
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
    // Arrange: Create user with only Queued/Failed files
    const userId = crypto.randomUUID()

    await insertUser({userId, email: 'noready@example.com', firstName: 'NoReady'})

    await insertFile({fileId: 'queued-only', status: FileStatus.Queued, title: 'Queued Only'})
    await insertFile({fileId: 'failed-only', status: FileStatus.Failed, title: 'Failed Only'})

    await linkUserFile(userId, 'queued-only')
    await linkUserFile(userId, 'failed-only')

    // Act
    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    // Assert
    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    // No Downloaded files, so empty result
    expect(response.body.keyCount).toBe(0)
    expect(response.body.contents).toHaveLength(0)
  })
})
