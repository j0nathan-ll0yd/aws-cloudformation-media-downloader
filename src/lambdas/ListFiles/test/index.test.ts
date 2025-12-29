import {beforeEach, describe, expect, test, vi} from 'vitest'
import {testContext} from '#util/vitest-setup'
import {v4 as uuidv4} from 'uuid'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import {FileStatus} from '#types/enums'

// Set DefaultFile env vars BEFORE importing handler (required by constants.ts at module level)
process.env.DEFAULT_FILE_SIZE = '1024'
process.env.DEFAULT_FILE_NAME = 'test-default-file.mp4'
process.env.DEFAULT_FILE_URL = 'https://example.com/test-default-file.mp4'
process.env.DEFAULT_FILE_CONTENT_TYPE = 'video/mp4'

const fakeUserId = uuidv4()
const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})

// Mock native Drizzle query functions
vi.mock('#entities/queries', () => ({getFilesForUser: vi.fn()}))

const {handler} = await import('./../src')
import {getFilesForUser} from '#entities/queries'

/** Creates a mock file with specified status and publish date */
function createMockFile(fileId: string, status: FileStatus, publishDate: string) {
  return {
    fileId,
    key: `${fileId}.mp4`,
    status: status as string,
    publishDate,
    title: `Test Video ${fileId}`,
    size: 1000000,
    contentType: 'video/mp4',
    url: `https://example.com/${fileId}.mp4`,
    authorName: 'Test Author',
    authorUser: 'test-user',
    description: 'Test description'
  }
}

describe('#ListFiles', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    // Default to authenticated user
    event.requestContext.authorizer!.principalId = fakeUserId
  })
  test('(anonymous) should return default file for anonymous users', async () => {
    // Without Authorization header = Anonymous
    delete event.headers.Authorization
    event.requestContext.authorizer!.principalId = 'unknown'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    const body = JSON.parse(output.body)
    expect(body.body.keyCount).toEqual(1)
    expect(body.body.contents[0].key).toEqual('test-default-file.mp4')
  })
  test('(unauthenticated) should return 401 for unauthenticated users', async () => {
    // With Authorization header but unknown principalId = Unauthenticated
    event.requestContext.authorizer!.principalId = 'unknown'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)
  })
  test('(authenticated) should return empty list when user has no files', async () => {
    vi.mocked(getFilesForUser).mockResolvedValue([])
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    const body = JSON.parse(output.body)
    expect(body.body.keyCount).toEqual(0)
  })

  test('(authenticated) should return multiple files when user has files', async () => {
    const files = [
      createMockFile('file-1', FileStatus.Downloaded, '2023-12-01'),
      createMockFile('file-2', FileStatus.Downloaded, '2023-12-02'),
      createMockFile('file-3', FileStatus.Downloaded, '2023-12-03')
    ]
    vi.mocked(getFilesForUser).mockResolvedValue(files)

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    const body = JSON.parse(output.body)
    expect(body.body.keyCount).toEqual(3)
    expect(body.body.contents).toHaveLength(3)
  })

  test('(authenticated) should only return Downloaded files, filtering out other statuses', async () => {
    const files = [
      createMockFile('downloaded-file', FileStatus.Downloaded, '2023-12-01'),
      createMockFile('queued-file', FileStatus.Queued, '2023-12-02'),
      createMockFile('failed-file', FileStatus.Failed, '2023-12-03'),
      createMockFile('downloading-file', FileStatus.Downloading, '2023-12-04')
    ]
    vi.mocked(getFilesForUser).mockResolvedValue(files)

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    const body = JSON.parse(output.body)
    expect(body.body.keyCount).toEqual(1)
    expect(body.body.contents[0].fileId).toEqual('downloaded-file')
  })

  test('(authenticated) should sort files by publishDate in descending order (newest first)', async () => {
    // Create files with different dates (not in order)
    const files = [
      createMockFile('old-file', FileStatus.Downloaded, '2023-01-01'),
      createMockFile('new-file', FileStatus.Downloaded, '2023-12-31'),
      createMockFile('mid-file', FileStatus.Downloaded, '2023-06-15')
    ]
    vi.mocked(getFilesForUser).mockResolvedValue(files)

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    const body = JSON.parse(output.body)
    expect(body.body.keyCount).toEqual(3)
    // Verify sorted by publishDate descending (newest first)
    expect(body.body.contents[0].fileId).toEqual('new-file')
    expect(body.body.contents[1].fileId).toEqual('mid-file')
    expect(body.body.contents[2].fileId).toEqual('old-file')
  })

  test('(authenticated) should combine filtering and sorting correctly', async () => {
    // Test that both filtering (Downloaded only) and sorting (newest first) work together
    const files = [
      createMockFile('old-downloaded', FileStatus.Downloaded, '2023-01-01'),
      createMockFile('new-queued', FileStatus.Queued, '2023-12-31'),
      createMockFile('new-downloaded', FileStatus.Downloaded, '2023-12-15')
    ]
    vi.mocked(getFilesForUser).mockResolvedValue(files)

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    const body = JSON.parse(output.body)
    // Should only return Downloaded files (2), sorted by publishDate (newest first)
    expect(body.body.keyCount).toEqual(2)
    expect(body.body.contents[0].fileId).toEqual('new-downloaded')
    expect(body.body.contents[1].fileId).toEqual('old-downloaded')
  })

  describe('#AWSFailure', () => {
    test('should return 500 error when file retrieval fails', async () => {
      vi.mocked(getFilesForUser).mockRejectedValue(new Error('Database connection failed'))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
      const body = JSON.parse(output.body)
      expect(Object.keys(body)).toEqual(expect.arrayContaining(['error', 'requestId']))
    })
  })
})
