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

import {describe, test, expect, beforeAll, afterAll, beforeEach, jest} from '@jest/globals'
import {FileStatus} from '../../../src/types/enums'

// Test helpers
import {createFilesTable, deleteFilesTable, getFile} from '../helpers/dynamodb-helpers'
import {createTestBucket, deleteTestBucket, getObjectMetadata} from '../helpers/s3-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {
  createMockVideoInfo,
  createMockVideoFormat,
  createMockVideoStream,
  createMockStreamVideoToS3WithRealUpload
} from '../helpers/mock-youtube'
import {createS3Upload} from '../../../src/lib/vendor/AWS/S3'

// Test configuration
const TEST_BUCKET = 'test-integration-bucket'
const TEST_TABLE = 'test-files'

// Set environment variables for Lambda
process.env.Bucket = TEST_BUCKET
process.env.DynamoDBTableFiles = TEST_TABLE
process.env.USE_LOCALSTACK = 'true'

describe('StartFileUpload Workflow Integration Tests', () => {
  let handler: any
  let mockContext: any

  beforeAll(async () => {
    // Create LocalStack infrastructure
    await createTestBucket(TEST_BUCKET)
    await createFilesTable()

    // Wait for tables to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Create mock context
    mockContext = createMockContext()
  })

  afterAll(async () => {
    // Clean up LocalStack infrastructure
    await deleteTestBucket(TEST_BUCKET)
    await deleteFilesTable()
  })

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks()

    // Mock the YouTube vendor module
    const mockVideoInfo = createMockVideoInfo({
      id: 'test-video-123',
      title: 'Integration Test Video',
      uploader: 'Test Channel'
    })

    const mockFormat = createMockVideoFormat({
      format_id: '18',
      ext: 'mp4',
      filesize: 5242880 // 5MB
    })

    // Mock YouTube vendor functions
    jest.unstable_mockModule('../../../src/lib/vendor/YouTube', () => ({
      fetchVideoInfo: jest.fn().mockResolvedValue(mockVideoInfo),
      chooseVideoFormat: jest.fn().mockReturnValue(mockFormat),
      streamVideoToS3: createMockStreamVideoToS3WithRealUpload(createS3Upload)
    }))

    // Mock GitHub helpers (don't create real issues in tests)
    jest.unstable_mockModule('../../../src/util/github-helpers', () => ({
      createVideoDownloadFailureIssue: jest.fn().mockResolvedValue(undefined),
      createCookieExpirationIssue: jest.fn().mockResolvedValue(undefined)
    }))

    // Import handler AFTER mocks are set up
    const module = await import('../../../src/lambdas/StartFileUpload/src/index')
    handler = module.handler
  })

  test('should complete video download workflow with correct DynamoDB state transitions', async () => {
    // Arrange: Video ID to download
    const fileId = 'test-video-123'
    const event = {fileId}

    // Act: Invoke StartFileUpload handler
    const result = await handler(event, mockContext)

    // Assert: Lambda response is successful
    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.fileId).toBe(fileId)
    expect(body.status).toBe('success')
    expect(body.fileSize).toBe(5242880)

    // Assert: DynamoDB file record has correct final state
    const file = await getFile(fileId)
    expect(file).not.toBeNull()
    expect(file!.fileId).toBe(fileId)
    expect(file!.status).toBe(FileStatus.Downloaded)
    expect(file!.size).toBe(5242880)
    expect(file!.key).toBe('test-video-123.mp4')
    expect(file!.title).toBe('Integration Test Video')
    expect(file!.authorName).toBe('Test Channel')
    expect(file!.contentType).toBe('video/mp4')

    // Assert: S3 object exists with correct size
    const s3Metadata = await getObjectMetadata(TEST_BUCKET, 'test-video-123.mp4')
    expect(s3Metadata).not.toBeNull()
    expect(s3Metadata!.contentLength).toBe(5242880)
    expect(s3Metadata!.contentType).toBe('video/mp4')
  }, 30000) // 30 second timeout for S3 upload

  test('should update DynamoDB to failed status when S3 upload fails', async () => {
    // Arrange: Mock streamVideoToS3 to fail
    jest.unstable_mockModule('../../../src/lib/vendor/YouTube', () => ({
      fetchVideoInfo: jest.fn().mockResolvedValue(createMockVideoInfo({id: 'fail-video'})),
      chooseVideoFormat: jest.fn().mockReturnValue(createMockVideoFormat()),
      streamVideoToS3: jest.fn().mockRejectedValue(new Error('Mock S3 upload failed'))
    }))

    // Re-import handler with new mock
    const module = await import('../../../src/lambdas/StartFileUpload/src/index')
    handler = module.handler

    const fileId = 'fail-video'
    const event = {fileId}

    // Act: Invoke handler (should fail gracefully)
    const result = await handler(event, mockContext)

    // Assert: Lambda returns error response
    expect(result.statusCode).toBe(500)

    // Assert: DynamoDB file record has failed status
    const file = await getFile(fileId)
    expect(file).not.toBeNull()
    expect(file!.status).toBe(FileStatus.Failed)
  }, 30000)

  test('should handle concurrent uploads of different videos without conflicts', async () => {
    // Arrange: Three different video IDs
    const fileIds = ['concurrent-1', 'concurrent-2', 'concurrent-3']

    const events = fileIds.map((id) => ({fileId: id}))

    // Mock different video info for each
    const mockInfos = fileIds.map((id) =>
      createMockVideoInfo({
        id,
        title: `Concurrent Video ${id}`
      })
    )

    // Mock YouTube functions to return appropriate info based on URL
    jest.unstable_mockModule('../../../src/lib/vendor/YouTube', () => {
      let callIndex = 0
      return {
        fetchVideoInfo: jest.fn().mockImplementation(() => {
          const info = mockInfos[callIndex % mockInfos.length]
          callIndex++
          return Promise.resolve(info)
        }),
        chooseVideoFormat: jest.fn().mockReturnValue(createMockVideoFormat()),
        streamVideoToS3: createMockStreamVideoToS3WithRealUpload(createS3Upload)
      }
    })

    // Re-import handler
    const module = await import('../../../src/lambdas/StartFileUpload/src/index')
    handler = module.handler

    // Act: Start all uploads concurrently
    const results = await Promise.all(events.map((event) => handler(event, mockContext)))

    // Assert: All responses are successful
    results.forEach((result, index) => {
      expect(result.statusCode).toBe(200)
      const body = JSON.parse(result.body)
      expect(body.status).toBe('success')
    })

    // Assert: All files exist in DynamoDB with Downloaded status
    const files = await Promise.all(fileIds.map((id) => getFile(id)))

    files.forEach((file, index) => {
      expect(file).not.toBeNull()
      expect(file!.fileId).toBe(fileIds[index])
      expect(file!.status).toBe(FileStatus.Downloaded)
      expect(file!.size).toBe(5242880)
    })

    // Assert: All files exist in S3
    const s3Metadata = await Promise.all(fileIds.map((id) => getObjectMetadata(TEST_BUCKET, `${id}.mp4`)))

    s3Metadata.forEach((metadata) => {
      expect(metadata).not.toBeNull()
      expect(metadata!.contentLength).toBe(5242880)
    })
  }, 60000) // 60 second timeout for concurrent uploads

  test('should handle large file upload using multipart', async () => {
    // Arrange: Mock large video (50MB)
    const largeFileSize = 50 * 1024 * 1024 // 50MB

    const mockLargeVideoInfo = createMockVideoInfo({
      id: 'large-video',
      title: 'Large Test Video'
    })

    const mockLargeFormat = createMockVideoFormat({
      filesize: largeFileSize
    })

    // Mock YouTube functions for large file
    jest.unstable_mockModule('../../../src/lib/vendor/YouTube', () => ({
      fetchVideoInfo: jest.fn().mockResolvedValue(mockLargeVideoInfo),
      chooseVideoFormat: jest.fn().mockReturnValue(mockLargeFormat),
      streamVideoToS3: jest.fn(async (uri: string, bucket: string, key: string) => {
        // Create large mock video stream
        const largeStream = createMockVideoStream(largeFileSize)

        // Use REAL S3 multipart upload
        const upload = createS3Upload(bucket, key, largeStream, 'video/mp4', {
          partSize: 5 * 1024 * 1024, // 5MB parts
          queueSize: 4
        })

        await upload.done()

        return {
          fileSize: largeFileSize,
          s3Url: `s3://${bucket}/${key}`,
          duration: 3000
        }
      })
    }))

    // Re-import handler
    const module = await import('../../../src/lambdas/StartFileUpload/src/index')
    handler = module.handler

    const fileId = 'large-video'
    const event = {fileId}

    // Act: Upload large file
    const result = await handler(event, mockContext)

    // Assert: Upload succeeded
    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.fileSize).toBe(largeFileSize)

    // Assert: DynamoDB has correct size
    const file = await getFile(fileId)
    expect(file).not.toBeNull()
    expect(file!.size).toBe(largeFileSize)
    expect(file!.status).toBe(FileStatus.Downloaded)

    // Assert: S3 object has correct size (multipart upload succeeded)
    const s3Metadata = await getObjectMetadata(TEST_BUCKET, 'large-video.mp4')
    expect(s3Metadata).not.toBeNull()
    expect(s3Metadata!.contentLength).toBe(largeFileSize)
  }, 90000) // 90 second timeout for large file upload
})
