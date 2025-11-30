/**
 * FileCoordinator Workflow Integration Tests
 *
 * Tests the file coordination workflow against LocalStack:
 * 1. Scan DynamoDB for files ready to download (availableAt is past due AND no url)
 * 2. Fan-out: Invoke StartFileUpload Lambda for each pending file
 * 3. Handle empty queue gracefully
 */

const TEST_TABLE = 'test-files-coordinator'
process.env.DynamoDBTableName = TEST_TABLE
process.env.USE_LOCALSTACK = 'true'

import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals'
import type {Context} from 'aws-lambda'
import {FileStatus} from '../../../src/types/enums'
import {createFilesTable, deleteFilesTable, insertFile} from '../helpers/dynamodb-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createMockScheduledEvent} from '../helpers/test-data'
import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'

interface FileInvocationPayload {
  fileId: string
}

type LambdaCallArgs = [string, Record<string, unknown>]

// Compute module path from test file location (Jest ESM mock resolution workaround)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const lambdaModulePath = resolve(__dirname, '../../../src/lib/vendor/AWS/Lambda')

const invokeLambdaMock = jest.fn<() => Promise<{ StatusCode: number }>>()
jest.unstable_mockModule(lambdaModulePath, () => ({ invokeLambda: invokeLambdaMock, invokeAsync: invokeLambdaMock }))

const { handler } = await import('../../../src/lambdas/FileCoordinator/src/index')

async function insertPendingFile(fileId: string, availableAt: number, title?: string) {
  await insertFile({ fileId, status: FileStatus.PendingDownload, availableAt, title: title || `Test Video ${fileId}` })
}

describe('FileCoordinator Workflow Integration Tests', () => {
  let mockContext: Context

  beforeAll(async () => {
    await createFilesTable()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    mockContext = createMockContext()
  })

  afterAll(async () => {
    await deleteFilesTable()
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    invokeLambdaMock.mockClear()
    invokeLambdaMock.mockResolvedValue({ StatusCode: 202 })

    await deleteFilesTable()
    await createFilesTable()
    await new Promise((resolve) => setTimeout(resolve, 500))
  })

  test('should fan-out to multiple StartFileUpload invocations for pending files', async () => {
    const now = Date.now()
    const fileIds = ['video-1', 'video-2', 'video-3']

    await Promise.all(fileIds.map((fileId) => insertPendingFile(fileId, now - 1000)))

    const result = await handler(createMockScheduledEvent('test-event-1'), mockContext)

    expect(result.statusCode).toBe(200)
    expect(invokeLambdaMock).toHaveBeenCalledTimes(3)

    const invocationPayloads = (invokeLambdaMock.mock.calls as unknown as LambdaCallArgs[]).map((call) =>
      call[1] as unknown as FileInvocationPayload
    )
    const invokedFileIds = invocationPayloads.map((payload) => payload.fileId).sort()

    expect(invokedFileIds).toEqual(fileIds.sort())
  })

  test('should handle empty queue gracefully', async () => {
    const result = await handler(createMockScheduledEvent('test-event-2'), mockContext)

    expect(result.statusCode).toBe(200)
    expect(invokeLambdaMock).not.toHaveBeenCalled()
  })

  test('should only process files with availableAt <= now', async () => {
    const now = Date.now()

    await insertPendingFile('past-video', now - 10000, 'Past Video')
    await insertPendingFile('future-video', now + 86400000, 'Future Video')
    await insertPendingFile('now-video', now, 'Now Video')

    const result = await handler(createMockScheduledEvent('test-event-3'), mockContext)

    expect(result.statusCode).toBe(200)
    expect(invokeLambdaMock).toHaveBeenCalledTimes(2)

    const invocationPayloads = (invokeLambdaMock.mock.calls as unknown as LambdaCallArgs[]).map((call) =>
      call[1] as unknown as FileInvocationPayload
    )
    const invokedFileIds = invocationPayloads.map((payload) => payload.fileId).sort()

    expect(invokedFileIds).toEqual(['now-video', 'past-video'])
  })

  test('should skip files that already have url attribute', async () => {
    const now = Date.now()

    await insertPendingFile('pending-video', now - 1000, 'Pending Video')

    await insertFile({
      fileId: 'downloaded-video',
      status: FileStatus.Downloaded,
      availableAt: now - 1000,
      title: 'Downloaded Video',
      key: 'downloaded-video.mp4',
      size: 5242880
    })

    const { Files } = await import('../../../src/entities/Files')
    await Files.update({ fileId: 'downloaded-video' }).set({ url: 'https://s3.amazonaws.com/bucket/downloaded-video.mp4' })
      .go()

    const result = await handler(createMockScheduledEvent('test-event-4'), mockContext)

    expect(result.statusCode).toBe(200)
    expect(invokeLambdaMock).toHaveBeenCalledTimes(1)

    const invocationPayload = (invokeLambdaMock.mock.calls as unknown as LambdaCallArgs[])[0][
      1
    ] as unknown as FileInvocationPayload
    expect(invocationPayload.fileId).toBe('pending-video')
  })

  test('should handle concurrent execution without conflicts', async () => {
    const now = Date.now()
    const fileIds = ['concurrent-1', 'concurrent-2', 'concurrent-3', 'concurrent-4', 'concurrent-5']

    await Promise.all(fileIds.map((fileId) => insertPendingFile(fileId, now - 1000)))

    const [result1, result2] = await Promise.all([
      handler(createMockScheduledEvent('test-event-5a'), mockContext),
      handler(createMockScheduledEvent('test-event-5b'), mockContext)
    ])

    expect(result1.statusCode).toBe(200)
    expect(result2.statusCode).toBe(200)

    // Both invocations scan all files (idempotent)
    // StartFileUpload handles deduplication via conditional updates
    expect(invokeLambdaMock).toHaveBeenCalledTimes(10)
  })
})
