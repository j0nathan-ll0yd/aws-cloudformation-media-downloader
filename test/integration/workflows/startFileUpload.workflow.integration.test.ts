/**
 * StartFileUpload Workflow Integration Tests
 *
 * Tests the complete video download workflow:
 * - YouTube API: mocked (fetchVideoInfo, streamVideoToS3)
 * - Files entity: LocalStack DynamoDB
 * - FileDownloads entity: mocked (transient orchestration state)
 * - S3 storage: LocalStack S3
 *
 * This tests orchestration logic, not AWS SDK behavior.
 */

// Test configuration
const TEST_BUCKET = 'test-integration-bucket-upload'
const TEST_TABLE = 'test-files-upload'

// Set environment variables for Lambda
process.env.BUCKET = TEST_BUCKET
process.env.DYNAMODB_TABLE_NAME = TEST_TABLE
process.env.USE_LOCALSTACK = 'true'
process.env.CLOUDFRONT_DOMAIN = 'test.cloudfront.net'
process.env.SNS_QUEUE_URL = 'http://sqs.us-west-2.localhost.localstack.cloud:4566/000000000000/test-queue'
process.env.EVENT_BUS_NAME = 'MediaDownloader'

import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals'
import type {Context} from 'aws-lambda'
import {DownloadStatus, FileStatus} from '#types/enums'

// Test helpers
import {createFilesTable, deleteFilesTable, getFile} from '#test/integration/helpers/dynamodb-helpers'
import {createTestBucket, deleteTestBucket} from '#test/integration/helpers/s3-helpers'
import {createMockContext} from '#test/integration/helpers/lambda-context'
import {createMockVideoInfo} from '#test/integration/helpers/mock-youtube'
import {createMockDownloadQueueEvent} from '#test/integration/helpers/test-data'
import {createElectroDBEntityMock} from '#test/helpers/electrodb-mock'

const mockVideoInfo = createMockVideoInfo({id: 'test-video-123', title: 'Integration Test Video', uploader: 'Test Channel'})

// Mock file size for download response
const MOCK_FILE_SIZE = 5242880

// FetchVideoInfoResult type for the new safe fetchVideoInfo API
type FetchVideoInfoResult = {success: boolean; info?: typeof mockVideoInfo; error?: Error; isCookieError?: boolean}

// Mock modules using path aliases to match how handler imports them
jest.unstable_mockModule('#lib/vendor/YouTube', () => ({
  // fetchVideoInfo now returns a result object {success, info, error}
  fetchVideoInfo: jest.fn<() => Promise<FetchVideoInfoResult>>().mockResolvedValue({success: true, info: mockVideoInfo}),
  // downloadVideoToS3 replaces the old streamVideoToS3 - returns fileSize, s3Url, duration
  downloadVideoToS3: jest.fn<() => Promise<{fileSize: number; s3Url: string; duration: number}>>().mockResolvedValue({
    fileSize: MOCK_FILE_SIZE,
    s3Url: `s3://${TEST_BUCKET}/test-video-123.mp4`,
    duration: 180
  })
}))

jest.unstable_mockModule('#lib/integrations/github/issue-service', () => ({
  createVideoDownloadFailureIssue: jest.fn<() => Promise<void>>().mockResolvedValue(undefined), // fmt: multiline
  createCookieExpirationIssue: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
}))

// Mock FileDownloads entity (transient orchestration state)
const fileDownloadsMock = createElectroDBEntityMock()
jest.unstable_mockModule('#entities/FileDownloads', () => ({
  FileDownloads: fileDownloadsMock.entity,
  DownloadStatus // Re-export the real enum
}))

// Mock UserFiles entity for MetadataNotification dispatch
const userFilesMock = createElectroDBEntityMock({queryIndexes: ['byFile']})
jest.unstable_mockModule('#entities/UserFiles', () => ({UserFiles: userFilesMock.entity}))

// Mock SQS sendMessage for MetadataNotification
jest.unstable_mockModule('#lib/vendor/AWS/SQS',
  () => ({
    sendMessage: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    stringAttribute: jest.fn((value: string) => ({DataType: 'String', StringValue: value})),
    numberAttribute: jest.fn((value: number) => ({DataType: 'Number', StringValue: value.toString()}))
  }))

// Mock EventBridge for publishing DownloadCompleted/DownloadFailed events
jest.unstable_mockModule('#lib/vendor/AWS/EventBridge', () => ({publishEvent: jest.fn<() => unknown>()}))

// Note: No #lambdas/* path alias exists, using relative import for handler
const {handler} = await import('../../../src/lambdas/StartFileUpload/src/index')

describe('StartFileUpload Workflow Integration Tests', () => {
  let mockContext: Context

  beforeAll(async () => {
    await createTestBucket(TEST_BUCKET)
    await createFilesTable()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    mockContext = createMockContext()
  })

  afterAll(async () => {
    await deleteTestBucket(TEST_BUCKET)
    await deleteFilesTable()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    // Return empty user list for MetadataNotification dispatch (no users waiting)
    userFilesMock.mocks.query.byFile!.go.mockResolvedValue({data: []})
  })

  test('should complete video download workflow with correct DynamoDB state transitions', async () => {
    const fileId = 'test-video-123'
    const event = createMockDownloadQueueEvent(fileId, {correlationId: 'test-corr-id'})

    const result = await handler(event, mockContext)

    // SQS handler returns SQSBatchResponse with batchItemFailures
    expect(result.batchItemFailures).toEqual([])

    const file = await getFile(fileId)
    expect(file).not.toBeNull()
    expect(file!.fileId).toBe(fileId)
    expect(file!.status).toBe(FileStatus.Downloaded)
    expect(file!.size).toBe(MOCK_FILE_SIZE)
    expect(file!.key).toBe('test-video-123.mp4')
    expect(file!.title).toBe('Integration Test Video')
    expect(file!.authorName).toBe('Test Channel')
    expect(file!.contentType).toBe('video/mp4')

    // Note: S3 upload is mocked in this orchestration test.
    // S3 integration is validated in YouTube.ts unit tests.
  }, 30000)
})
