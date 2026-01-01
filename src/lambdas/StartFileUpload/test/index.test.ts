import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import type {SQSEvent} from 'aws-lambda'
import type {FetchVideoInfoResult} from '#types/video'
import type {YtDlpVideoInfo} from '#types/youtube'
import {CookieExpirationError, UnexpectedError} from '#lib/system/errors'
import {testContext} from '#util/vitest-setup'
import {createMockFile, createMockFileDownload, createMockUserFile} from '#test/helpers/entity-fixtures'
import {createDownloadQueueEvent, createSQSEvent} from '#test/helpers/event-factories'
import {mockClient} from 'aws-sdk-client-mock'
import {SendMessageCommand, SQSClient} from '@aws-sdk/client-sqs'
import {EventBridgeClient, PutEventsCommand} from '@aws-sdk/client-eventbridge'
import {createEventBridgePutEventsResponse, createSQSSendMessageResponse} from '#test/helpers/aws-response-factories'

// Create AWS mocks - intercept all client.send() calls
const sqsMock = mockClient(SQSClient)
const eventBridgeMock = mockClient(EventBridgeClient)

// Mock YouTube functions
const fetchVideoInfoMock = vi.fn<(url: string) => Promise<FetchVideoInfoResult>>()
const downloadVideoToS3Mock = vi.fn<(url: string, bucket: string, key: string) => Promise<{fileSize: number; s3Url: string; duration: number}>>()

vi.mock('#lib/vendor/YouTube', () => ({fetchVideoInfo: fetchVideoInfoMock, downloadVideoToS3: downloadVideoToS3Mock}))

// Mock native Drizzle query functions
vi.mock('#entities/queries',
  () => ({getFileDownload: vi.fn(), updateFileDownload: vi.fn(), createFileDownload: vi.fn(), getUserFilesByFileId: vi.fn(), upsertFile: vi.fn()}))

// Mock GitHub issue creation (for permanent failures)
vi.mock('#lib/integrations/github/issue-service', () => ({createCookieExpirationIssue: vi.fn(), createVideoDownloadFailureIssue: vi.fn()}))

// Mock circuit breaker - pass through to wrapped function in tests
vi.mock('#lib/system/circuit-breaker',
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
import {createFileDownload, getFileDownload, getUserFilesByFileId, updateFileDownload, upsertFile} from '#entities/queries'

describe('#StartFileUpload', () => {
  const context = testContext
  let event: SQSEvent

  const createSuccessResult = (info: Partial<YtDlpVideoInfo>): FetchVideoInfoResult => ({
    success: true,
    info: {
      id: 'test-video-id',
      title: 'Test Video',
      thumbnail: 'https://example.com/thumbnail.jpg',
      duration: 300,
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
    // Create SQS event with download queue message
    event = createDownloadQueueEvent('YcuKhcqzt7w', {messageId: 'test-message-id-123'})

    vi.clearAllMocks()
    sqsMock.reset()
    eventBridgeMock.reset()

    vi.mocked(getFileDownload).mockResolvedValue(null)
    vi.mocked(updateFileDownload).mockResolvedValue(mockFileDownloadRow())
    vi.mocked(createFileDownload).mockResolvedValue(mockFileDownloadRow())
    vi.mocked(upsertFile).mockResolvedValue(mockFileRow())
    vi.mocked(getUserFilesByFileId).mockResolvedValue([mockUserFileRow()])

    // Configure AWS mock responses using factories
    sqsMock.on(SendMessageCommand).resolves(createSQSSendMessageResponse())
    eventBridgeMock.on(PutEventsCommand).resolves(createEventBridgePutEventsResponse())

    process.env.BUCKET = 'test-bucket'
    process.env.AWS_REGION = 'us-west-2'
    process.env.DYNAMODB_TABLE_NAME = 'test-table'
    process.env.CLOUDFRONT_DOMAIN = 'test-cdn.cloudfront.net'
    process.env.SNS_QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/123456789/SendPushNotification'
    process.env.EVENT_BUS_NAME = 'MediaDownloader'
  })

  afterEach(() => {
    sqsMock.reset()
    eventBridgeMock.reset()
  })

  test('should successfully download video and return no failures', async () => {
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'YcuKhcqzt7w'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 82784319, s3Url: 's3://test-bucket/test-video.mp4', duration: 45})

    const result = await handler(event, context)

    expect(result.batchItemFailures).toEqual([])
    expect(vi.mocked(upsertFile)).toHaveBeenCalled()
    // When no existing download record, handler creates new ones
    expect(vi.mocked(createFileDownload)).toHaveBeenCalled()
    expect(eventBridgeMock).toHaveReceivedCommandWith(PutEventsCommand, {
      Entries: expect.arrayContaining([
        expect.objectContaining({DetailType: 'DownloadCompleted', Detail: expect.stringContaining('YcuKhcqzt7w')})
      ])
    })
  })

  test('should handle large video files', async () => {
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'YcuKhcqzt7w', title: 'Large Video'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 104857600, s3Url: 's3://test-bucket/test-video.mp4', duration: 120})

    const result = await handler(event, context)

    expect(result.batchItemFailures).toEqual([])
    expect(vi.mocked(upsertFile)).toHaveBeenCalled()
  })

  test('should report batch failure for transient download errors', async () => {
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'YcuKhcqzt7w'}))
    downloadVideoToS3Mock.mockRejectedValue(new Error('Network timeout'))

    const result = await handler(event, context)

    // Transient errors should cause batch item failure for SQS retry
    expect(result.batchItemFailures).toEqual([{itemIdentifier: 'test-message-id-123'}])
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
    expect(result.batchItemFailures).toEqual([{itemIdentifier: 'test-message-id-123'}])
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
    expect(result.batchItemFailures).toEqual([{itemIdentifier: 'test-message-id-123'}])
  })

  test('should not retry when max retries exceeded', async () => {
    vi.mocked(getFileDownload).mockResolvedValue({
      fileId: 'test',
      retryCount: 5,
      maxRetries: 5,
      status: 'InProgress',
      retryAfter: null,
      errorCategory: null,
      lastError: null,
      scheduledReleaseTime: null,
      sourceUrl: null,
      correlationId: null,
      createdAt: new Date(),
      updatedAt: new Date()
    })
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
    vi.mocked(getUserFilesByFileId).mockResolvedValue([{userId: 'user-1', fileId: 'test', createdAt: new Date()}, {
      userId: 'user-2',
      fileId: 'test',
      createdAt: new Date()
    }, {userId: 'user-3', fileId: 'test', createdAt: new Date()}])
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'YcuKhcqzt7w', title: 'Test Video', uploader: 'Test Uploader'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 82784319, s3Url: 's3://test-bucket/test-video.mp4', duration: 45})

    const result = await handler(event, context)

    expect(result.batchItemFailures).toEqual([])
    expect(vi.mocked(getUserFilesByFileId)).toHaveBeenCalled()
    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 3)
  })

  test('should skip MetadataNotification when no users are waiting', async () => {
    vi.mocked(getUserFilesByFileId).mockResolvedValue([])
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'YcuKhcqzt7w'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 82784319, s3Url: 's3://test-bucket/test-video.mp4', duration: 45})

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
})
