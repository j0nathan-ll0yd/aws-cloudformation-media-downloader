/**
 * File Retry Integration Tests
 *
 * Tests the FileCoordinator scheduled workflow for retry logic:
 * 1. Query pending files (new downloads from WebhookFeedly)
 * 2. Query scheduled files ready for retry (retryAfter less than or equal to now)
 * 3. Process files in batches with delays
 * 4. Handle empty queues gracefully
 * 5. Verify metrics are published
 *
 * Validates:
 * - Pending and scheduled files are both processed
 * - Batch processing with delays between batches
 * - Deduplication of file IDs
 * - Metrics publication for monitoring
 */

// Test configuration
const TEST_TABLE = 'test-file-retry'

// Set environment variables for Lambda
process.env.DynamoDBTableName = TEST_TABLE
process.env.USE_LOCALSTACK = 'true'

// Required env vars
process.env.DefaultFileSize = '1024'
process.env.DefaultFileName = 'test-default-file.mp4'
process.env.DefaultFileUrl = 'https://example.com/test-default-file.mp4'
process.env.DefaultFileContentType = 'video/mp4'
process.env.StartFileUploadFunctionName = 'StartFileUpload'

import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals'
import type {Context} from 'aws-lambda'

// Test helpers
import {createFilesTable, deleteFilesTable} from '../helpers/dynamodb-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createElectroDBEntityMock} from '../../helpers/electrodb-mock'
import {createMockScheduledEvent} from '../helpers/test-data'

import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Mock FileDownloads entity
const fileDownloadsModulePath = resolve(__dirname, '../../../src/entities/FileDownloads')
const fileDownloadsMock = createElectroDBEntityMock({queryIndexes: ['byStatusRetryAfter']})
jest.unstable_mockModule(fileDownloadsModulePath, () => ({
  FileDownloads: fileDownloadsMock.entity,
  DownloadStatus: {Pending: 'pending', Scheduled: 'scheduled', InProgress: 'in-progress', Completed: 'completed', Failed: 'failed'}
}))

// Mock shared utilities (initiateFileDownload)
const sharedModulePath = resolve(__dirname, '../../../src/util/shared')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const initiateFileDownloadMock = jest.fn<any>()
jest.unstable_mockModule(sharedModulePath, () => ({
  initiateFileDownload: initiateFileDownloadMock,
  getUserDevices: jest.fn(),
  subscribeEndpointToTopic: jest.fn(),
  deleteDevice: jest.fn()
}))

// Mock CloudWatch metrics
const cloudwatchModulePath = resolve(__dirname, '../../../src/lib/vendor/AWS/CloudWatch')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const putMetricDataMock = jest.fn<any>()
jest.unstable_mockModule(cloudwatchModulePath, () => ({
  putMetricData: putMetricDataMock,
  getStandardUnit: jest.fn().mockReturnValue('Count')
}))

// Import handler after mocking
const {handler} = await import('../../../src/lambdas/FileCoordinator/src/index')

interface FileDownload {
  fileId: string
  status: string
  retryAfter?: number
  attemptCount?: number
}

function createMockFileDownload(fileId: string, status: string, retryAfter?: number): FileDownload {
  return {
    fileId,
    status,
    retryAfter,
    attemptCount: status === 'scheduled' ? 1 : 0
  }
}

describe('File Retry Integration Tests', () => {
  let mockContext: Context

  beforeAll(async () => {
    await createFilesTable()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    mockContext = createMockContext()
  })

  afterAll(async () => {
    await deleteFilesTable()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    initiateFileDownloadMock.mockResolvedValue(undefined)
    putMetricDataMock.mockResolvedValue(undefined)
  })

  test('should process pending files (new downloads)', async () => {
    const pendingFiles = ['file-pending-1', 'file-pending-2', 'file-pending-3']

    // Mock pending files query
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce({
      data: pendingFiles.map((fileId) => createMockFileDownload(fileId, 'pending'))
    })

    // Mock scheduled files query (empty)
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce({
      data: []
    })

    const event = createMockScheduledEvent('test-event-1')
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)
    expect(response.body.processed).toBe(3)
    expect(response.body.pending).toBe(3)
    expect(response.body.scheduled).toBe(0)

    // Verify initiateFileDownload called for each file
    expect(initiateFileDownloadMock).toHaveBeenCalledTimes(3)
    pendingFiles.forEach((fileId) => {
      expect(initiateFileDownloadMock).toHaveBeenCalledWith(fileId)
    })
  })

  test('should process scheduled files ready for retry', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const scheduledFiles = [
      createMockFileDownload('file-retry-1', 'scheduled', nowSeconds - 100),
      createMockFileDownload('file-retry-2', 'scheduled', nowSeconds - 50)
    ]

    // Mock pending files query (empty)
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce({
      data: []
    })

    // Mock scheduled files query
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce({
      data: scheduledFiles
    })

    const event = createMockScheduledEvent('test-event-2')
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)
    expect(response.body.processed).toBe(2)
    expect(response.body.pending).toBe(0)
    expect(response.body.scheduled).toBe(2)

    expect(initiateFileDownloadMock).toHaveBeenCalledTimes(2)
  })

  test('should process both pending and scheduled files', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)

    // Mock pending files
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce({
      data: [createMockFileDownload('file-pending-1', 'pending')]
    })

    // Mock scheduled files
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce({
      data: [createMockFileDownload('file-retry-1', 'scheduled', nowSeconds - 100)]
    })

    const event = createMockScheduledEvent('test-event-3')
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)
    expect(response.body.processed).toBe(2)
    expect(response.body.pending).toBe(1)
    expect(response.body.scheduled).toBe(1)

    expect(initiateFileDownloadMock).toHaveBeenCalledTimes(2)
    expect(initiateFileDownloadMock).toHaveBeenCalledWith('file-pending-1')
    expect(initiateFileDownloadMock).toHaveBeenCalledWith('file-retry-1')
  })

  test('should deduplicate file IDs', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)

    // Same file appears in both pending and scheduled (edge case)
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce({
      data: [createMockFileDownload('file-duplicate', 'pending')]
    })

    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce({
      data: [createMockFileDownload('file-duplicate', 'scheduled', nowSeconds - 100)]
    })

    const event = createMockScheduledEvent('test-event-4')
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)
    // Only processed once due to deduplication
    expect(response.body.processed).toBe(1)

    expect(initiateFileDownloadMock).toHaveBeenCalledTimes(1)
  })

  test('should return 200 with zero processed when no files to process', async () => {
    // Both queries return empty
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValue({
      data: []
    })

    const event = createMockScheduledEvent('test-event-5')
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)
    expect(response.body.processed).toBe(0)

    // No downloads initiated
    expect(initiateFileDownloadMock).not.toHaveBeenCalled()
  })

  test('should publish CloudWatch metrics', async () => {
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce({
      data: [createMockFileDownload('file-1', 'pending')]
    })
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce({
      data: [createMockFileDownload('file-2', 'scheduled', Math.floor(Date.now() / 1000) - 100)]
    })

    const event = createMockScheduledEvent('test-event-6')
    await handler(event, mockContext)

    // Verify metrics were published
    expect(putMetricDataMock).toHaveBeenCalled()
  })

  test('should handle DynamoDB query failure gracefully', async () => {
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockRejectedValue(
      new Error('DynamoDB service unavailable')
    )

    const event = createMockScheduledEvent('test-event-7')
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(500)
  })

  test('should process files in batches for large queues', async () => {
    // Create more files than BATCH_SIZE (5)
    const fileIds = Array.from({length: 12}, (_, i) => `file-batch-${i}`)

    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce({
      data: fileIds.map((fileId) => createMockFileDownload(fileId, 'pending'))
    })
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce({
      data: []
    })

    const event = createMockScheduledEvent('test-event-8')
    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)
    expect(response.body.processed).toBe(12)

    // All 12 files should be processed
    expect(initiateFileDownloadMock).toHaveBeenCalledTimes(12)
  }, 60000) // Longer timeout for batch processing with delays

  test('should fail entire batch when any file download fails (Promise.all behavior)', async () => {
    const fileIds = ['file-ok-1', 'file-fail', 'file-ok-2']

    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce({
      data: fileIds.map((fileId) => createMockFileDownload(fileId, 'pending'))
    })
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce({
      data: []
    })

    // Make middle file fail
    initiateFileDownloadMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Download failed'))
      .mockResolvedValueOnce(undefined)

    const event = createMockScheduledEvent('test-event-9')
    const result = await handler(event, mockContext)

    // Handler uses Promise.all which fails fast on any rejection
    // This is expected behavior - batch fails if any download fails
    expect(result.statusCode).toBe(500)
  })
})
