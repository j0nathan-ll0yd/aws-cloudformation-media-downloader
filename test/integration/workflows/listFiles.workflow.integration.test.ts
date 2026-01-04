/**
 * ListFiles Workflow Integration Tests
 *
 * Tests the file listing workflow including user status handling,
 * file queries, and response filtering.
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
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'

// Test helpers
import {createMockContext} from '../helpers/lambda-context'
import {closeTestDb, createAllTables, getTestDbAsync, insertFile, insertUser, linkUserFile, truncateAllTables} from '../helpers/postgres-helpers'
import {createMockCustomAPIGatewayEvent} from '../helpers/test-data'

const {handler} = await import('#lambdas/ListFiles/src/index')

// Helper using centralized factory
function createListFilesEvent(userId: string | undefined, userStatus: UserStatus): CustomAPIGatewayRequestAuthorizerEvent {
  return createMockCustomAPIGatewayEvent({path: '/files', httpMethod: 'GET', userId, userStatus})
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

    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(2)
    expect(response.body.contents).toHaveLength(2)
  })

  test('should return empty list when user has no files', async () => {
    const userId = crypto.randomUUID()
    await insertUser({userId, email: 'nofiles@example.com'})

    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)
    expect(response.body.keyCount).toBe(0)
    expect(response.body.contents).toHaveLength(0)
  })

  test('should return demo file for anonymous user without querying database', async () => {
    const event = createListFilesEvent(undefined, UserStatus.Anonymous)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(1)
    expect(response.body.contents).toHaveLength(1)
    expect(response.body.contents[0]).toHaveProperty('fileId')
  })

  test('should return 401 for unauthenticated user', async () => {
    const event = createListFilesEvent(undefined, UserStatus.Unauthenticated)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(401)
  })

  test('should filter out non-Downloaded files', async () => {
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

    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(2)
    expect(response.body.contents).toHaveLength(2)
    expect(response.body.contents.every((f: {status: string}) => f.status === FileStatus.Downloaded)).toBe(true)
  })

  test('should handle large batch of files efficiently', async () => {
    const userId = crypto.randomUUID()
    await insertUser({userId, email: 'batch@example.com'})

    for (let i = 0; i < 25; i++) {
      const fileId = `video-batch-${i}`
      await insertFile({fileId, key: `${fileId}.mp4`, status: FileStatus.Downloaded, title: `Video ${i}`})
      await linkUserFile(userId, fileId)
    }

    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(25)
    expect(response.body.contents).toHaveLength(25)
  })

  test('should return files with full metadata', async () => {
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

    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.contents).toHaveLength(1)
    const file = response.body.contents[0]
    expect(file.title).toBe('Full Metadata Video')
    expect(file.authorName).toBe('Test Channel')
    expect(file.size).toBe(10485760)
  })

  test('should handle user with only non-Downloaded files', async () => {
    const userId = crypto.randomUUID()
    await insertUser({userId, email: 'queued-only@example.com'})

    await insertFile({fileId: 'queued-only', key: 'queued-only.mp4', status: FileStatus.Queued, title: 'Queued Only'})
    await linkUserFile(userId, 'queued-only')

    const event = createListFilesEvent(userId, UserStatus.Authenticated)
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(0)
    expect(response.body.contents).toHaveLength(0)
  })
})
