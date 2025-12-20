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
import {DownloadStatus} from '#types/enums'
import {createFilesTable, deleteFilesTable} from '#test/integration/helpers/dynamodb-helpers'
import {createMockContext} from '#test/integration/helpers/lambda-context'
import {createMockScheduledEvent} from '#test/integration/helpers/test-data'

// Type the mock with full signature so mock.calls is properly typed
const invokeLambdaMock = jest.fn<(arn: string, payload: {fileId: string}) => Promise<{StatusCode: number}>>()
jest.unstable_mockModule('#lib/vendor/AWS/Lambda', () => ({invokeLambda: invokeLambdaMock, invokeAsync: invokeLambdaMock}))

// Note: No #lambdas/* path alias exists, using relative import for handler
const {handler} = await import('../../../src/lambdas/FileCoordinator/src/index')

// Helper to insert a FileDownloads record for testing
async function insertFileDownload(fileId: string, status: DownloadStatus, retryAfter?: number) {
  const {FileDownloads} = await import('#entities/FileDownloads')
  await FileDownloads.create({fileId, status, retryAfter, sourceUrl: `https://www.youtube.com/watch?v=${fileId}`}).go()
}

// Helper to clear FileDownloads table
async function clearFileDownloads() {
  const {FileDownloads} = await import('#entities/FileDownloads')
  // Query and delete all - for testing purposes
  const pending = await FileDownloads.query.byStatusRetryAfter({status: DownloadStatus.Pending}).go()
  const scheduled = await FileDownloads.query.byStatusRetryAfter({status: DownloadStatus.Scheduled}).go()
  const all = [...(pending.data || []), ...(scheduled.data || [])]
  for (const record of all) {
    await FileDownloads.delete({fileId: record.fileId}).go()
  }
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
    invokeLambdaMock.mockResolvedValue({StatusCode: 202})

    // Clear FileDownloads between tests
    await clearFileDownloads()
  })

  test('should fan-out to multiple StartFileUpload invocations for pending downloads', async () => {
    // Create 3 pending download records
    await insertFileDownload('video-1', DownloadStatus.Pending)
    await insertFileDownload('video-2', DownloadStatus.Pending)
    await insertFileDownload('video-3', DownloadStatus.Pending)

    // FileCoordinator is a scheduled handler that returns void
    await handler(createMockScheduledEvent('test-event-1'), mockContext)

    expect(invokeLambdaMock).toHaveBeenCalledTimes(3)

    const invokedFileIds = invokeLambdaMock.mock.calls.map(([, payload]) => payload.fileId).sort()
    expect(invokedFileIds).toEqual(['video-1', 'video-2', 'video-3'])
  })

  test('should handle empty queue gracefully', async () => {
    // No FileDownloads records - should handle gracefully (returns void)
    await handler(createMockScheduledEvent('test-event-2'), mockContext)

    expect(invokeLambdaMock).not.toHaveBeenCalled()
  })

  test('should process scheduled retries with retryAfter <= now', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)

    // Scheduled retry ready to process
    await insertFileDownload('past-retry', DownloadStatus.Scheduled, nowSeconds - 100)
    // Scheduled retry not yet ready
    await insertFileDownload('future-retry', DownloadStatus.Scheduled, nowSeconds + 3600)
    // Another ready one
    await insertFileDownload('now-retry', DownloadStatus.Scheduled, nowSeconds)

    await handler(createMockScheduledEvent('test-event-3'), mockContext)

    // Should process 2 retries (past-retry and now-retry, not future-retry)
    expect(invokeLambdaMock).toHaveBeenCalledTimes(2)

    const invokedFileIds = invokeLambdaMock.mock.calls.map(([, payload]) => payload.fileId).sort()
    expect(invokedFileIds).toEqual(['now-retry', 'past-retry'])
  })

  test('should process both pending and scheduled downloads', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)

    // Pending download (new)
    await insertFileDownload('pending-video', DownloadStatus.Pending)
    // Scheduled retry (ready)
    await insertFileDownload('scheduled-video', DownloadStatus.Scheduled, nowSeconds - 100)

    await handler(createMockScheduledEvent('test-event-4'), mockContext)

    // Both pending and scheduled should be processed
    expect(invokeLambdaMock).toHaveBeenCalledTimes(2)
  })
})
