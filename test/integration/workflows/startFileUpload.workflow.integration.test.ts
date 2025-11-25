/**
 * StartFileUpload Workflow Integration Tests
 *
 * Tests the complete video download workflow against LocalStack:
 * 1. Fetch video info from YouTube (mocked)
 * 2. Update DynamoDB with "PendingDownload" status (REAL LocalStack)
 * 3. Stream video to S3 (REAL LocalStack)
 * 4. Update DynamoDB with "Downloaded" status (REAL LocalStack)
 * 5. Handle errors with rollback to "Failed" status
 *
 * This tests YOUR orchestration logic, not AWS SDK behavior.
 */

// Test configuration
const TEST_BUCKET = 'test-integration-bucket-upload'
const TEST_TABLE = 'test-files-upload'

// Set environment variables for Lambda
process.env.Bucket = TEST_BUCKET
process.env.DynamoDBTableName = TEST_TABLE
process.env.USE_LOCALSTACK = 'true'

import {describe, test, expect, beforeAll, afterAll, beforeEach, jest} from '@jest/globals'
import {FileStatus} from '../../../src/types/enums'

// Test helpers
import {createFilesTable, deleteFilesTable, getFile} from '../helpers/dynamodb-helpers'
import {createTestBucket, deleteTestBucket, getObjectMetadata} from '../helpers/s3-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createMockVideoInfo, createMockVideoFormat, createMockStreamVideoToS3WithRealUpload} from '../helpers/mock-youtube'
import {createS3Upload} from '../../../src/lib/vendor/AWS/S3'

import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const youtubeModulePath = resolve(__dirname, '../../../src/lib/vendor/YouTube')
const githubHelpersModulePath = resolve(__dirname, '../../../src/util/github-helpers')

const mockVideoInfo = createMockVideoInfo({
  id: 'test-video-123',
  title: 'Integration Test Video',
  uploader: 'Test Channel'
})

const mockFormat = createMockVideoFormat({
  format_id: '18',
  ext: 'mp4',
  filesize: 5242880
})

jest.unstable_mockModule(youtubeModulePath, () => ({
  fetchVideoInfo: jest.fn<() => Promise<typeof mockVideoInfo>>().mockResolvedValue(mockVideoInfo),
  chooseVideoFormat: jest.fn<() => typeof mockFormat>().mockReturnValue(mockFormat),
  streamVideoToS3: createMockStreamVideoToS3WithRealUpload(createS3Upload)
}))

jest.unstable_mockModule(githubHelpersModulePath, () => ({
  createVideoDownloadFailureIssue: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  createCookieExpirationIssue: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
}))

const module = await import('../../../src/lambdas/StartFileUpload/src/index')
const handler = module.handler

describe('StartFileUpload Workflow Integration Tests', () => {
  let mockContext: any

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
  })

  test('should complete video download workflow with correct DynamoDB state transitions', async () => {
    const fileId = 'test-video-123'
    const event = {fileId}

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)
    expect(response.body.fileId).toBe(fileId)
    expect(response.body.status).toBe('success')
    expect(response.body.fileSize).toBe(5242880)

    const file = await getFile(fileId)
    expect(file).not.toBeNull()
    expect(file!.fileId).toBe(fileId)
    expect(file!.status).toBe(FileStatus.Downloaded)
    expect(file!.size).toBe(5242880)
    expect(file!.key).toBe('test-video-123.mp4')
    expect(file!.title).toBe('Integration Test Video')
    expect(file!.authorName).toBe('Test Channel')
    expect(file!.contentType).toBe('video/mp4')

    const s3Metadata = await getObjectMetadata(TEST_BUCKET, 'test-video-123.mp4')
    expect(s3Metadata).not.toBeNull()
    expect(s3Metadata!.contentLength).toBe(5242880)
    expect(s3Metadata!.contentType).toBe('video/mp4')
  }, 30000)
})
