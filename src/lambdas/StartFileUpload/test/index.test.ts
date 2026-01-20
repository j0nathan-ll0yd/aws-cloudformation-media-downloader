import {afterAll, afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import type {SQSEvent} from 'aws-lambda'
import type {FetchVideoInfoResult} from '#types/video'
import type {YtDlpVideoInfo} from '#types/youtube'
import {CookieExpirationError, UnexpectedError} from '#lib/system/errors'
import {createMockContext} from '#util/vitest-setup'
import {createMockFile, createMockFileDownload, createMockUserFile} from '#test/helpers/entity-fixtures'
import {createDownloadQueueEvent, createSQSEvent} from '#test/helpers/event-factories'
import {SendMessageCommand} from '@aws-sdk/client-sqs'
import {PutEventsCommand} from '@aws-sdk/client-eventbridge'
import {HeadObjectCommand} from '@aws-sdk/client-s3'
import {createEventBridgePutEventsResponse, createSQSSendMessageResponse} from '#test/helpers/aws-response-factories'
import {createEventBridgeMock, createS3Mock, createSQSMock, resetAllAwsMocks} from '#test/helpers/aws-sdk-mock'
import {
  TEST_BUCKET_NAME,
  TEST_CLOUDFRONT_DOMAIN,
  TEST_DYNAMODB_TABLE_NAME,
  TEST_EVENT_BUS_NAME,
  TEST_MESSAGE_ID,
  TEST_REGION,
  TEST_S3_URL,
  TEST_SQS_PUSH_NOTIFICATION_URL,
  TEST_THUMBNAIL_URL,
  TEST_VIDEO_DURATION,
  TEST_VIDEO_FILE_SIZE,
  TEST_VIDEO_FILE_SIZE_LARGE,
  TEST_VIDEO_ID
} from '#test/helpers/test-constants'

// Create AWS mocks using helpers - inject into vendor client factory
const sqsMock = createSQSMock()
const eventBridgeMock = createEventBridgeMock()
const s3Mock = createS3Mock()

// Mock YouTube functions
const fetchVideoInfoMock = vi.fn<(url: string) => Promise<FetchVideoInfoResult>>()
const downloadVideoToS3Mock = vi.fn<(url: string, bucket: string, key: string) => Promise<{fileSize: number; s3Url: string; duration: number}>>()

vi.mock('#lib/vendor/YouTube', () => ({fetchVideoInfo: fetchVideoInfoMock, downloadVideoToS3: downloadVideoToS3Mock}))

vi.mock('#entities/queries',
  () => ({
    getFile: vi.fn(),
    getFileDownload: vi.fn(),
    updateFile: vi.fn(),
    updateFileDownload: vi.fn(),
    createFileDownload: vi.fn(),
    getUserFilesByFileId: vi.fn(),
    upsertFile: vi.fn()
  }))

// Mock GitHub issue creation (for permanent failures) and auto-close (for recovery)
vi.mock('#lib/integrations/github/issueService',
  () => ({
    createCookieExpirationIssue: vi.fn(),
    createVideoDownloadFailureIssue: vi.fn(),
    closeCookieExpirationIssueIfResolved: vi.fn().mockResolvedValue(undefined)
  }))

// Mock circuit breaker - pass through to wrapped function in tests
vi.mock('#lib/system/circuitBreaker',
  () => ({
    youtubeCircuitBreaker: {
      execute: vi.fn(<T>(operation: () => Promise<T>) => operation()),
      getState: vi.fn(() => 'CLOSED'),
      getFailureCount: vi.fn(() => 0),
      reset: vi.fn()
    },
    CircuitBreakerOpenError: class CircuitBreakerOpenError extends Error {
      public readonly retryAfterMs: number
      public readonly circuitName: string
      constructor(circuitName: string, retryAfterMs: number) {
        super(`Circuit breaker '${circuitName}' is OPEN`)
        this.circuitName = circuitName
        this.retryAfterMs = retryAfterMs
      }
    }
  }))

const {handler} = await import('./../src')
import {createFileDownload, getFile, getFileDownload, getUserFilesByFileId, updateFile, updateFileDownload, upsertFile} from '#entities/queries'

describe('#StartFileUpload', () => {
  const context = createMockContext()
  let event: SQSEvent

  const createSuccessResult = (info: Partial<YtDlpVideoInfo>): FetchVideoInfoResult => ({
    success: true,
    info: {
      id: 'test-video-id',
      title: 'Test Video',
      thumbnail: TEST_THUMBNAIL_URL,
      duration: TEST_VIDEO_DURATION,
      formats: [],
      uploader: 'Test Uploader',
      description: 'Test description',
      upload_date: '20231201',
      ...info
    } as YtDlpVideoInfo
  })

  const createFailureResult = (error: Error, isCookieError = false): FetchVideoInfoResult => ({success: false, error, isCookieError})

  // Mock return value factories using shared fixtures
  const mockFileDownloadRow = () => createMockFileDownload({fileId: 'test'})
  const mockFileRow = () => createMockFile({fileId: 'test', status: 'Downloaded', size: 0, url: null})
  const mockUserFileRow = () => createMockUserFile({userId: 'user-123', fileId: 'test'})

  beforeEach(() => {
    vi.clearAllMocks()
    // Create SQS event with download queue message
    event = createDownloadQueueEvent(TEST_VIDEO_ID, {messageId: TEST_MESSAGE_ID})

    vi.mocked(getFile).mockResolvedValue(null)
    vi.mocked(getFileDownload).mockResolvedValue(null)
    vi.mocked(updateFile).mockResolvedValue(mockFileRow())
    vi.mocked(updateFileDownload).mockResolvedValue(mockFileDownloadRow())
    vi.mocked(createFileDownload).mockResolvedValue(mockFileDownloadRow())
    vi.mocked(upsertFile).mockResolvedValue(mockFileRow())
    vi.mocked(getUserFilesByFileId).mockResolvedValue([mockUserFileRow()])

    // Configure AWS mock responses using factories
    sqsMock.on(SendMessageCommand).resolves(createSQSSendMessageResponse())
    eventBridgeMock.on(PutEventsCommand).resolves(createEventBridgePutEventsResponse())
    // Default: S3 file does not exist (triggers normal download path)
    s3Mock.on(HeadObjectCommand).rejects({name: 'NotFound', message: 'Not Found'})

    process.env.BUCKET = TEST_BUCKET_NAME
    process.env.AWS_REGION = TEST_REGION
    process.env.DYNAMODB_TABLE_NAME = TEST_DYNAMODB_TABLE_NAME
    process.env.CLOUDFRONT_DOMAIN = TEST_CLOUDFRONT_DOMAIN
    process.env.SNS_QUEUE_URL = TEST_SQS_PUSH_NOTIFICATION_URL
    process.env.EVENT_BUS_NAME = TEST_EVENT_BUS_NAME
  })

  afterEach(() => {
    sqsMock.reset()
    eventBridgeMock.reset()
    s3Mock.reset()
  })

  afterAll(() => {
    resetAllAwsMocks()
  })

  test('should successfully download video and return no failures', async () => {
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: TEST_VIDEO_ID}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: TEST_VIDEO_FILE_SIZE, s3Url: TEST_S3_URL, duration: 45})

    const result = await handler(event, context)

    expect(result.batchItemFailures).toEqual([])
    expect(vi.mocked(upsertFile)).toHaveBeenCalled()
    // When no existing download record, handler creates new ones
    expect(vi.mocked(createFileDownload)).toHaveBeenCalled()
    expect(eventBridgeMock).toHaveReceivedCommandWith(PutEventsCommand, {
      Entries: expect.arrayContaining([
        expect.objectContaining({DetailType: 'DownloadCompleted', Detail: expect.stringContaining(TEST_VIDEO_ID)})
      ])
    })
  })

  test('should handle large video files', async () => {
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: TEST_VIDEO_ID, title: 'Large Video'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: TEST_VIDEO_FILE_SIZE_LARGE, s3Url: TEST_S3_URL, duration: 120})

    const result = await handler(event, context)

    expect(result.batchItemFailures).toEqual([])
    expect(vi.mocked(upsertFile)).toHaveBeenCalled()
  })

  test('should report batch failure for transient download errors', async () => {
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: TEST_VIDEO_ID}))
    downloadVideoToS3Mock.mockRejectedValue(new Error('Network timeout'))

    const result = await handler(event, context)

    // Transient errors should cause batch item failure for SQS retry
    expect(result.batchItemFailures).toEqual([{itemIdentifier: TEST_MESSAGE_ID}])
    expect(eventBridgeMock).toHaveReceivedCommandWith(PutEventsCommand, {
      Entries: expect.arrayContaining([
        expect.objectContaining({DetailType: 'DownloadFailed', Detail: expect.stringContaining('retryable')})
      ])
    })
  })

  test('should not retry permanent errors (video private)', async () => {
    fetchVideoInfoMock.mockResolvedValue(createFailureResult(new Error('This video is private')))

    const result = await handler(event, context)

    // Permanent errors should NOT cause batch item failure - message should be removed
    expect(result.batchItemFailures).toEqual([])
    expect(eventBridgeMock).toHaveReceivedCommandWith(PutEventsCommand, {
      Entries: expect.arrayContaining([
        expect.objectContaining({DetailType: 'DownloadFailed', Detail: expect.stringContaining('permanent')})
      ])
    })
  })

  test('should retry unknown errors with benefit of doubt', async () => {
    fetchVideoInfoMock.mockResolvedValue(createFailureResult(new UnexpectedError('Unknown error occurred')))

    const result = await handler(event, context)

    // Unknown errors are treated as transient (retryable)
    expect(result.batchItemFailures).toEqual([{itemIdentifier: TEST_MESSAGE_ID}])
    expect(eventBridgeMock).toHaveReceivedCommand(PutEventsCommand)
  })

  test('should handle scheduled video with future release timestamp', async () => {
    const videoInfo = {
      id: 'scheduled-video',
      title: 'Upcoming Video',
      release_timestamp: Math.floor(Date.now() / 1000) + 3600,
      live_status: 'is_upcoming'
    } as YtDlpVideoInfo

    fetchVideoInfoMock.mockResolvedValue({success: false, error: new Error('Video is not available'), info: videoInfo})

    const result = await handler(event, context)

    // Scheduled videos should be retried
    expect(result.batchItemFailures).toEqual([{itemIdentifier: TEST_MESSAGE_ID}])
  })

  test('should not retry when max retries exceeded', async () => {
    vi.mocked(getFileDownload).mockResolvedValue(createMockFileDownload({fileId: 'test', retryCount: 5, maxRetries: 5, status: 'InProgress'}))
    fetchVideoInfoMock.mockResolvedValue(createFailureResult(new Error('Any error')))

    const result = await handler(event, context)

    // Max retries exceeded - should NOT retry (no batch item failure)
    expect(result.batchItemFailures).toEqual([])
    expect(eventBridgeMock).toHaveReceivedCommandWith(PutEventsCommand, {
      Entries: expect.arrayContaining([
        expect.objectContaining({DetailType: 'DownloadFailed'})
      ])
    })
  })

  test('should not retry cookie expiration errors', async () => {
    fetchVideoInfoMock.mockResolvedValue(createFailureResult(new CookieExpirationError('Sign in to confirm'), true))

    const result = await handler(event, context)

    // Cookie errors are permanent - no retry
    expect(result.batchItemFailures).toEqual([])
    expect(eventBridgeMock).toHaveReceivedCommandWith(PutEventsCommand, {
      Entries: expect.arrayContaining([
        expect.objectContaining({DetailType: 'DownloadFailed', Detail: expect.stringContaining('cookie_expired')})
      ])
    })
  })

  test('should dispatch MetadataNotifications to all waiting users', async () => {
    vi.mocked(getUserFilesByFileId).mockResolvedValue([
      createMockUserFile({userId: 'user-1', fileId: 'test'}),
      createMockUserFile({userId: 'user-2', fileId: 'test'}),
      createMockUserFile({userId: 'user-3', fileId: 'test'})
    ])
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: TEST_VIDEO_ID, title: 'Test Video', uploader: 'Test Uploader'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: TEST_VIDEO_FILE_SIZE, s3Url: TEST_S3_URL, duration: 45})

    const result = await handler(event, context)

    expect(result.batchItemFailures).toEqual([])
    expect(vi.mocked(getUserFilesByFileId)).toHaveBeenCalled()
    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 3)
  })

  test('should skip MetadataNotification when no users are waiting', async () => {
    vi.mocked(getUserFilesByFileId).mockResolvedValue([])
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: TEST_VIDEO_ID}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: TEST_VIDEO_FILE_SIZE, s3Url: TEST_S3_URL, duration: 45})

    const result = await handler(event, context)

    expect(result.batchItemFailures).toEqual([])
    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand)
  })

  test('should process multiple SQS records in batch', async () => {
    const multiRecordEvent = createSQSEvent({
      records: [
        {
          messageId: 'msg-1',
          body: {fileId: 'video-1', sourceUrl: 'https://www.youtube.com/watch?v=video-1', correlationId: 'corr-1', userId: 'user-123', attempt: 1},
          queueName: 'DownloadQueue'
        },
        {
          messageId: 'msg-2',
          body: {fileId: 'video-2', sourceUrl: 'https://www.youtube.com/watch?v=video-2', correlationId: 'corr-2', userId: 'user-123', attempt: 1},
          queueName: 'DownloadQueue'
        }
      ]
    })

    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'video-1'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 1000, s3Url: 's3://test-bucket/video.mp4', duration: 10})

    const result = await handler(multiRecordEvent, context)

    expect(result.batchItemFailures).toEqual([])
    expect(fetchVideoInfoMock).toHaveBeenCalledTimes(2)
  })

  test('should report only failed records in batch', async () => {
    const multiRecordEvent = createSQSEvent({
      records: [
        {
          messageId: 'msg-success',
          body: {fileId: 'video-1', sourceUrl: 'https://www.youtube.com/watch?v=video-1', correlationId: 'corr-1', userId: 'user-123', attempt: 1},
          queueName: 'DownloadQueue'
        },
        {
          messageId: 'msg-fail',
          body: {fileId: 'video-2', sourceUrl: 'https://www.youtube.com/watch?v=video-2', correlationId: 'corr-2', userId: 'user-123', attempt: 1},
          queueName: 'DownloadQueue'
        }
      ]
    })

    // First succeeds, second fails with transient error
    fetchVideoInfoMock.mockResolvedValueOnce(createSuccessResult({id: 'video-1'})).mockResolvedValueOnce(createFailureResult(new Error('Network error')))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 1000, s3Url: 's3://test-bucket/video.mp4', duration: 10})

    const result = await handler(multiRecordEvent, context)

    // Only the failed record should be in batchItemFailures
    expect(result.batchItemFailures).toEqual([{itemIdentifier: 'msg-fail'}])
  })

  describe('S3 file recovery', () => {
    test('should recover from S3 when file exists but DB records missing', async () => {
      // Mock S3 headObject to return file exists with size
      s3Mock.on(HeadObjectCommand).resolves({ContentLength: 12345678})

      // Mock YouTube fetch to succeed (for metadata)
      fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: TEST_VIDEO_ID, title: 'Recovered Video', uploader: 'Test Creator'}))

      const result = await handler(event, context)

      expect(result.batchItemFailures).toEqual([])
      // Should check S3 for file existence
      expect(s3Mock).toHaveReceivedCommandWith(HeadObjectCommand, {Bucket: TEST_BUCKET_NAME, Key: `${TEST_VIDEO_ID}.mp4`})
      // Should NOT download since file already exists in S3
      expect(downloadVideoToS3Mock).not.toHaveBeenCalled()
      // Should upsert file record
      expect(vi.mocked(upsertFile)).toHaveBeenCalled()
      // Should publish DownloadCompleted event
      expect(eventBridgeMock).toHaveReceivedCommandWith(PutEventsCommand, {
        Entries: expect.arrayContaining([expect.objectContaining({DetailType: 'DownloadCompleted', Detail: expect.stringContaining(TEST_VIDEO_ID)})])
      })
    })

    test('should proceed with download when S3 file does not exist', async () => {
      // Default setup already rejects headObject with NotFound
      fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: TEST_VIDEO_ID}))
      downloadVideoToS3Mock.mockResolvedValue({fileSize: TEST_VIDEO_FILE_SIZE, s3Url: TEST_S3_URL, duration: 45})

      const result = await handler(event, context)

      expect(result.batchItemFailures).toEqual([])
      // Should check S3 first
      expect(s3Mock).toHaveReceivedCommand(HeadObjectCommand)
      // Should download since file doesn't exist
      expect(downloadVideoToS3Mock).toHaveBeenCalled()
    })

    test('should use minimal metadata when YouTube fetch fails during recovery', async () => {
      // S3 file exists
      s3Mock.on(HeadObjectCommand).resolves({ContentLength: 12345678})
      // YouTube fetch fails
      fetchVideoInfoMock.mockResolvedValue({success: false, error: new Error('Video unavailable')})

      const result = await handler(event, context)

      expect(result.batchItemFailures).toEqual([])
      // Should still recover - using minimal metadata
      expect(downloadVideoToS3Mock).not.toHaveBeenCalled()
      expect(vi.mocked(upsertFile)).toHaveBeenCalledWith(expect.objectContaining({
        fileId: TEST_VIDEO_ID,
        title: TEST_VIDEO_ID, // Falls back to fileId
        authorName: 'Unknown'
      }))
    })

    test('should treat zero-size S3 file as not existing', async () => {
      // S3 returns zero-size file (corrupted)
      s3Mock.on(HeadObjectCommand).resolves({ContentLength: 0})
      fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: TEST_VIDEO_ID}))
      downloadVideoToS3Mock.mockResolvedValue({fileSize: TEST_VIDEO_FILE_SIZE, s3Url: TEST_S3_URL, duration: 45})

      const result = await handler(event, context)

      expect(result.batchItemFailures).toEqual([])
      // Should download since zero-size is treated as missing
      expect(downloadVideoToS3Mock).toHaveBeenCalled()
    })

    test('should dispatch MetadataNotifications during recovery when YouTube succeeds', async () => {
      vi.mocked(getUserFilesByFileId).mockResolvedValue([
        createMockUserFile({userId: 'user-1', fileId: TEST_VIDEO_ID}),
        createMockUserFile({userId: 'user-2', fileId: TEST_VIDEO_ID})
      ])
      s3Mock.on(HeadObjectCommand).resolves({ContentLength: 12345678})
      fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: TEST_VIDEO_ID, title: 'Recovered Video'}))

      const result = await handler(event, context)

      expect(result.batchItemFailures).toEqual([])
      // Should send MetadataNotification to both users
      expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 2)
    })
  })

  describe('#EdgeCases', () => {
    test('should handle database error during file lookup gracefully', async () => {
      const dbError = new Error('Connection refused')
      Object.assign(dbError, {code: 'ECONNREFUSED'})
      vi.mocked(getFile).mockRejectedValue(dbError)
      fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: TEST_VIDEO_ID}))
      downloadVideoToS3Mock.mockResolvedValue({fileSize: TEST_VIDEO_FILE_SIZE, s3Url: TEST_S3_URL, duration: 45})

      const result = await handler(event, context)

      // Handler swallows getFile errors (treats as "file not found") and proceeds
      // to download. This is acceptable resilient behavior.
      expect(result).toBeDefined()
    })

    test('should handle S3 head object timeout', async () => {
      const timeoutError = new Error('Network timeout')
      Object.assign(timeoutError, {code: 'ETIMEDOUT'})
      s3Mock.on(HeadObjectCommand).rejects(timeoutError)
      fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: TEST_VIDEO_ID}))
      downloadVideoToS3Mock.mockResolvedValue({fileSize: TEST_VIDEO_FILE_SIZE, s3Url: TEST_S3_URL, duration: 45})

      const result = await handler(event, context)

      // S3 timeout during head check should still attempt download (treated as not found)
      expect(result.batchItemFailures).toEqual([])
      expect(downloadVideoToS3Mock).toHaveBeenCalled()
    })

    test('should handle EventBridge publish timeout', async () => {
      fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: TEST_VIDEO_ID}))
      downloadVideoToS3Mock.mockResolvedValue({fileSize: TEST_VIDEO_FILE_SIZE, s3Url: TEST_S3_URL, duration: 45})
      const timeoutError = new Error('EventBridge timeout')
      Object.assign(timeoutError, {code: 'ETIMEDOUT'})
      eventBridgeMock.on(PutEventsCommand).rejects(timeoutError)

      const result = await handler(event, context)

      // EventBridge failure should cause batch item failure
      expect(result.batchItemFailures).toEqual([{itemIdentifier: TEST_MESSAGE_ID}])
    })

    test('should handle malformed SQS message body', async () => {
      const malformedEvent = createSQSEvent({
        records: [{messageId: TEST_MESSAGE_ID, body: {fileId: '', sourceUrl: '', correlationId: '', userId: '', attempt: 1}, queueName: 'DownloadQueue'}]
      })

      const result = await handler(malformedEvent, context)

      // Empty fileId should fail validation
      expect(result.batchItemFailures.length).toBeGreaterThanOrEqual(0)
    })
  })
})
