/**
 * FileCoordinator Workflow Integration Tests
 *
 * Tests the FileCoordinator Lambda against real LocalStack DynamoDB:
 * 1. Query FileDownloads for pending downloads (status='pending')
 * 2. Query FileDownloads for scheduled retries (status='scheduled', retryAfter is past)
 * 3. Fan-out to StartFileUpload for each file
 *
 * Architecture: FileCoordinator now ONLY queries FileDownloads entity.
 * Files entity is for permanent metadata, FileDownloads for orchestration.
 */

// Test configuration
const TEST_TABLE = 'test-filecoordinator'
process.env.DynamoDBTableName = TEST_TABLE
process.env.USE_LOCALSTACK = 'true'
process.env.StartFileUploadFunctionArn = 'arn:aws:lambda:us-west-2:123456789012:function:StartFileUpload'

import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals'
import type {Context} from 'aws-lambda'
import {createFilesTable, deleteFilesTable} from '../helpers/dynamodb-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createMockScheduledEvent} from '../helpers/test-data'
import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// We need to resolve the path for Lambda mock since it's used by FileCoordinator
const lambdaModulePath = resolve(__dirname, '../../../src/lib/vendor/AWS/Lambda')
const invokeLambdaMock = jest.fn<() => Promise<{StatusCode: number}>>()
jest.unstable_mockModule(lambdaModulePath, () => ({invokeLambda: invokeLambdaMock, invokeAsync: invokeLambdaMock}))

const {handler} = await import('../../../src/lambdas/FileCoordinator/src/index')

// Helper to insert a FileDownloads record for testing
async function insertFileDownload(fileId: string, status: 'pending' | 'scheduled', retryAfter?: number) {
  const {FileDownloads} = await import('../../../src/entities/FileDownloads')
  await FileDownloads.create({
    fileId,
    status,
    retryAfter,
    sourceUrl: `https://www.youtube.com/watch?v=${fileId}`
  }).go()
}

// Helper to clear FileDownloads table
async function clearFileDownloads() {
  const {FileDownloads} = await import('../../../src/entities/FileDownloads')
  // Query and delete all - for testing purposes
  const pending = await FileDownloads.query.byStatusRetryAfter({status: 'pending'}).go()
  const scheduled = await FileDownloads.query.byStatusRetryAfter({status: 'scheduled'}).go()
  const all = [...(pending.data || []), ...(scheduled.data || [])]
  for (const record of all) {
    await FileDownloads.delete({fileId: record.fileId}).go()
  }
}

interface FileInvocationPayload {
  fileId: string
}

type LambdaCallArgs = [string, FileInvocationPayload]

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
    invokeLambdaMock.mockResolvedValue({StatusCode: 202})

    // Clear FileDownloads between tests
    await clearFileDownloads()
  })

  test('should fan-out to multiple StartFileUpload invocations for pending downloads', async () => {
    // Create 3 pending download records
    await insertFileDownload('video-1', 'pending')
    await insertFileDownload('video-2', 'pending')
    await insertFileDownload('video-3', 'pending')

    const result = await handler(createMockScheduledEvent('test-event-1'), mockContext)

    expect(result.statusCode).toBe(200)
    expect(invokeLambdaMock).toHaveBeenCalledTimes(3)

    const invocationPayloads = (invokeLambdaMock.mock.calls as unknown as LambdaCallArgs[]).map((call) => call[1] as unknown as FileInvocationPayload)
    const invokedFileIds = invocationPayloads.map((payload) => payload.fileId).sort()

    expect(invokedFileIds).toEqual(['video-1', 'video-2', 'video-3'])
  })

  test('should handle empty queue gracefully', async () => {
    // No FileDownloads records - should handle gracefully
    const result = await handler(createMockScheduledEvent('test-event-2'), mockContext)

    expect(result.statusCode).toBe(200)
    expect(invokeLambdaMock).not.toHaveBeenCalled()
  })

  test('should process scheduled retries with retryAfter <= now', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)

    // Scheduled retry ready to process
    await insertFileDownload('past-retry', 'scheduled', nowSeconds - 100)
    // Scheduled retry not yet ready
    await insertFileDownload('future-retry', 'scheduled', nowSeconds + 3600)
    // Another ready one
    await insertFileDownload('now-retry', 'scheduled', nowSeconds)

    const result = await handler(createMockScheduledEvent('test-event-3'), mockContext)

    expect(result.statusCode).toBe(200)
    // Should process 2 retries (past-retry and now-retry, not future-retry)
    expect(invokeLambdaMock).toHaveBeenCalledTimes(2)

    const invocationPayloads = (invokeLambdaMock.mock.calls as unknown as LambdaCallArgs[]).map((call) => call[1] as unknown as FileInvocationPayload)
    const invokedFileIds = invocationPayloads.map((payload) => payload.fileId).sort()

    expect(invokedFileIds).toEqual(['now-retry', 'past-retry'])
  })

  test('should process both pending and scheduled downloads', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)

    // Pending download (new)
    await insertFileDownload('pending-video', 'pending')
    // Scheduled retry (ready)
    await insertFileDownload('scheduled-video', 'scheduled', nowSeconds - 100)

    const result = await handler(createMockScheduledEvent('test-event-4'), mockContext)

    expect(result.statusCode).toBe(200)
    expect(invokeLambdaMock).toHaveBeenCalledTimes(2)

    const body = JSON.parse(result.body)
    expect(body.body.pending).toBe(1)
    expect(body.body.scheduled).toBe(1)
  })
})
