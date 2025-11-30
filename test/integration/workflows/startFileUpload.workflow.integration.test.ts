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
process.env.Bucket = TEST_BUCKET
process.env.DynamoDBTableName = TEST_TABLE
process.env.USE_LOCALSTACK = 'true'

import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals'
import type {Context} from 'aws-lambda'
import {DownloadStatus, FileStatus} from '#types/enums'

// Test helpers
import {createFilesTable, deleteFilesTable, getFile} from '../helpers/dynamodb-helpers'
import {createTestBucket, deleteTestBucket, getObjectMetadata} from '../helpers/s3-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createMockStreamVideoToS3WithRealUpload, createMockVideoFormat, createMockVideoInfo, S3UploadFunction} from '../helpers/mock-youtube'
import {createElectroDBEntityMock} from '../../helpers/electrodb-mock'
import {createS3Upload} from '#lib/vendor/AWS/S3'

// Type assertion for createS3Upload to match S3UploadFunction signature
const s3UploadFn = createS3Upload as S3UploadFunction

const mockVideoInfo = createMockVideoInfo({id: 'test-video-123', title: 'Integration Test Video', uploader: 'Test Channel'})

const mockFormat = createMockVideoFormat({format_id: '18', ext: 'mp4', filesize: 5242880})

// FetchVideoInfoResult type for the new safe fetchVideoInfo API
type FetchVideoInfoResult = {success: boolean; info?: typeof mockVideoInfo; error?: Error; isCookieError?: boolean}

// Mock modules using path aliases to match how handler imports them
jest.unstable_mockModule('#lib/vendor/YouTube', () => ({
  // fetchVideoInfo now returns a result object {success, info, error}
  fetchVideoInfo: jest.fn<() => Promise<FetchVideoInfoResult>>().mockResolvedValue({success: true, info: mockVideoInfo}),
  chooseVideoFormat: jest.fn<() => typeof mockFormat>().mockReturnValue(mockFormat),
  streamVideoToS3: createMockStreamVideoToS3WithRealUpload(s3UploadFn)
}))

jest.unstable_mockModule('#util/github-helpers', () => ({
  createVideoDownloadFailureIssue: jest.fn<() => Promise<void>>().mockResolvedValue(undefined), // fmt: multiline
  createCookieExpirationIssue: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
}))

// Mock FileDownloads entity (transient orchestration state)
const fileDownloadsMock = createElectroDBEntityMock()
jest.unstable_mockModule('#entities/FileDownloads', () => ({
  FileDownloads: fileDownloadsMock.entity,
  DownloadStatus // Re-export the real enum
}))

const module = await import('../../../src/lambdas/StartFileUpload/src/index')
const handler = module.handler

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
  })

  test('should complete video download workflow with correct DynamoDB state transitions', async () => {
    const fileId = 'test-video-123'
    const event = {fileId}

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)
    expect(response.body.fileId).toBe(fileId)
    expect(response.body.status).toBe('Success')
    expect(response.body.fileSize).toBe(5242880)

    const file = await getFile(fileId)
    expect(file).not.toBeNull()
    expect(file!.fileId).toBe(fileId)
    expect(file!.status).toBe(FileStatus.Available)
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
