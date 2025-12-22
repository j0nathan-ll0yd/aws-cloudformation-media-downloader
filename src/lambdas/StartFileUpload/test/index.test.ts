import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import type {PutEventsResultEntry} from '#lib/vendor/AWS/EventBridge'
import {createElectroDBEntityMock} from '#test/helpers/electrodb-mock'
import {DownloadStatus} from '#types/enums'
import type {FetchVideoInfoResult} from '#types/video'
import type {YtDlpVideoInfo} from '#types/youtube'
import {CookieExpirationError, UnexpectedError} from '#util/errors'
import {testContext} from '#util/jest-setup'
import type {SQSEvent} from 'aws-lambda'

// Mock YouTube functions
const fetchVideoInfoMock = jest.fn<(url: string) => Promise<FetchVideoInfoResult>>()
const downloadVideoToS3Mock = jest.fn<(url: string, bucket: string, key: string) => Promise<{fileSize: number; s3Url: string; duration: number}>>()

jest.unstable_mockModule('#lib/vendor/YouTube', () => ({fetchVideoInfo: fetchVideoInfoMock, downloadVideoToS3: downloadVideoToS3Mock}))

// Mock ElectroDB Files entity (for permanent metadata)
const filesMock = createElectroDBEntityMock()
jest.unstable_mockModule('#entities/Files', () => ({Files: filesMock.entity}))

// Mock ElectroDB FileDownloads entity (for transient download state)
const fileDownloadsMock = createElectroDBEntityMock()
jest.unstable_mockModule('#entities/FileDownloads', () => ({
  FileDownloads: fileDownloadsMock.entity,
  DownloadStatus // Re-export the real enum
}))

// Mock ElectroDB UserFiles entity (for querying users waiting for a file)
const userFilesMock = createElectroDBEntityMock({queryIndexes: ['byFile']})
jest.unstable_mockModule('#entities/UserFiles', () => ({UserFiles: userFilesMock.entity}))

// Mock SQS sendMessage for MetadataNotification dispatch
const sendMessageMock = jest.fn<() => Promise<{MessageId: string}>>()
jest.unstable_mockModule('#lib/vendor/AWS/SQS', () => ({
  sendMessage: sendMessageMock,
  // Re-export helpers used by transformers.ts
  stringAttribute: (value: string) => ({DataType: 'String', StringValue: value}),
  numberAttribute: (value: number) => ({DataType: 'Number', StringValue: String(value)})
}))

// Mock EventBridge for publishing events
const publishEventMock = jest.fn<(eventType: string, detail: object) => Promise<PutEventsResultEntry[]>>().mockResolvedValue([{EventId: 'test-event-id'}])
jest.unstable_mockModule('#lib/vendor/AWS/EventBridge',
  () => ({
    publishEvent: publishEventMock,
    EventType: {DownloadRequested: 'DownloadRequested', DownloadCompleted: 'DownloadCompleted', DownloadFailed: 'DownloadFailed'}
  }))

const {handler} = await import('./../src')

describe('#StartFileUpload', () => {
  const context = testContext

  // Helper to create SQS event from DownloadRequestedEvent
  const createSQSEvent = (fileId: string, correlationId?: string): SQSEvent => ({
    Records: [
      {
        messageId: 'test-message-id',
        receiptHandle: 'test-receipt-handle',
        body: JSON.stringify({detail: JSON.stringify({fileId, sourceUrl: `https://www.youtube.com/watch?v=${fileId}`, correlationId})}),
        attributes: {
          ApproximateReceiveCount: '1',
          SentTimestamp: '1633024800000',
          SenderId: 'test-sender',
          ApproximateFirstReceiveTimestamp: '1633024800000'
        },
        messageAttributes: {},
        md5OfBody: 'test-md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:DownloadQueue',
        awsRegion: 'us-west-2'
      }
    ]
  })

  // Helper to create a successful video info result
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

  // Helper to create a failure result
  const createFailureResult = (error: Error, isCookieError = false): FetchVideoInfoResult => ({success: false, error, isCookieError})

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Set default mock return values
    fileDownloadsMock.mocks.get.mockResolvedValue({data: null})
    fileDownloadsMock.mocks.update.go.mockResolvedValue({data: {}})
    fileDownloadsMock.mocks.create.mockResolvedValue({data: {}})
    filesMock.mocks.upsert.go.mockResolvedValue({data: {}})

    // Mock UserFiles.query.byFile for MetadataNotification dispatch
    userFilesMock.mocks.query.byFile!.go.mockResolvedValue({data: [{userId: 'user-123'}]})

    // Mock SQS sendMessage
    sendMessageMock.mockResolvedValue({MessageId: 'msg-123'})

    // Mock EventBridge publishEvent
    publishEventMock.mockResolvedValue([{EventId: 'test-event-id'}])

    // Set environment variables
    process.env.BUCKET = 'test-bucket'
    process.env.AWS_REGION = 'us-west-2'
    process.env.DYNAMODB_TABLE_NAME = 'test-table'
    process.env.CLOUDFRONT_DOMAIN = 'test-cdn.cloudfront.net'
    process.env.SNS_QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/123456789/SendPushNotification'
  })

  test('should successfully download video to S3 and publish DownloadCompleted event', async () => {
    const event = createSQSEvent('test-video-id')
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'test-video-id'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 82784319, s3Url: 's3://test-bucket/test-video.mp4', duration: 45})

    const output = await handler(event, context)

    expect(output.batchItemFailures).toEqual([])

    // Verify Files.upsert was called (for permanent metadata)
    expect(filesMock.mocks.upsert.go).toHaveBeenCalled()

    // Verify FileDownloads was updated (status changes: in_progress -> completed)
    expect(fileDownloadsMock.mocks.update.go).toHaveBeenCalled()

    // Verify DownloadCompleted event was published to EventBridge
    expect(publishEventMock).toHaveBeenCalledWith('DownloadCompleted', expect.objectContaining({fileId: 'test-video-id', fileSize: 82784319, duration: 45}))

    // Verify downloadVideoToS3 was called with correct parameters
    expect(downloadVideoToS3Mock).toHaveBeenCalledWith(expect.stringContaining('youtube.com/watch?v='), 'test-bucket', expect.stringMatching(/\.mp4$/))
  })

  test('should handle large video files', async () => {
    const event = createSQSEvent('test-video-large')
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'test-video-large', title: 'Large Video'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 104857600, s3Url: 's3://test-bucket/test-video.mp4', duration: 120})

    const output = await handler(event, context)

    expect(output.batchItemFailures).toEqual([])

    // Verify Files.upsert was called with success
    expect(filesMock.mocks.upsert.go).toHaveBeenCalled()

    // Verify DownloadCompleted event was published
    expect(publishEventMock).toHaveBeenCalledWith('DownloadCompleted', expect.objectContaining({fileId: 'test-video-large', fileSize: 104857600}))
  })

  test('should throw error for transient failures to enable SQS retry', async () => {
    const event = createSQSEvent('test-video-error')
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'test-video-error'}))
    downloadVideoToS3Mock.mockRejectedValue(new Error('Download failed'))

    const output = await handler(event, context)

    // Transient errors throw to trigger SQS retry
    expect(output.batchItemFailures).toHaveLength(1)
    expect(output.batchItemFailures[0].itemIdentifier).toEqual('test-message-id')

    // Verify FileDownloads was updated with scheduled status
    expect(fileDownloadsMock.mocks.update.go).toHaveBeenCalled()
  })

  test('should publish DownloadFailed event for permanent errors (video private)', async () => {
    const event = createSQSEvent('test-video-private')
    fetchVideoInfoMock.mockResolvedValue(createFailureResult(new Error('This video is private')))

    const output = await handler(event, context)

    // Permanent errors result in failed message
    expect(output.batchItemFailures).toHaveLength(1)

    // Verify DownloadFailed event was published to EventBridge
    expect(publishEventMock).toHaveBeenCalledWith('DownloadFailed', expect.objectContaining({fileId: 'test-video-private', category: 'permanent'}))

    // Verify FileDownloads was updated with failed status
    expect(fileDownloadsMock.mocks.update.go).toHaveBeenCalled()
  })

  test('should schedule retry for unknown errors (benefit of doubt)', async () => {
    const event = createSQSEvent('test-video-unknown')
    fetchVideoInfoMock.mockResolvedValue(createFailureResult(new UnexpectedError('Video not found')))

    const output = await handler(event, context)

    // Unknown errors get retried by SQS
    expect(output.batchItemFailures).toHaveLength(1)

    // Verify FileDownloads was updated with scheduled status
    expect(fileDownloadsMock.mocks.update.go).toHaveBeenCalled()
  })

  test('should handle fetch failure with video info for classification', async () => {
    const event = createSQSEvent('scheduled-video')
    const videoInfo = {
      id: 'scheduled-video',
      title: 'Upcoming Video',
      release_timestamp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      live_status: 'is_upcoming'
    } as YtDlpVideoInfo

    fetchVideoInfoMock.mockResolvedValue({success: false, error: new Error('Video is not available'), info: videoInfo})

    const output = await handler(event, context)

    // Should be scheduled for retry at release time
    expect(output.batchItemFailures).toHaveLength(1)
  })

  test('should handle FileDownloads update failures gracefully', async () => {
    const event = createSQSEvent('test-video-error')
    fetchVideoInfoMock.mockResolvedValue(createFailureResult(new Error('Video fetch failed')))
    fileDownloadsMock.mocks.update.go.mockImplementation(() => {
      throw new Error('DynamoDB error')
    })

    // The handler may throw or return error - verify we get failure reported
    const output = await handler(event, context)
    expect(output.batchItemFailures).toHaveLength(1)
  })

  test('should publish DownloadFailed event when max retries exceeded', async () => {
    const event = createSQSEvent('test-video-maxretries')
    fileDownloadsMock.mocks.get.mockResolvedValue({data: {fileId: 'test', retryCount: 5, maxRetries: 5}})
    fetchVideoInfoMock.mockResolvedValue(createFailureResult(new Error('Any error')))

    const output = await handler(event, context)

    // Max retries exceeded should result in failure
    expect(output.batchItemFailures).toHaveLength(1)

    // Verify DownloadFailed event was published
    expect(publishEventMock).toHaveBeenCalledWith('DownloadFailed', expect.objectContaining({fileId: 'test-video-maxretries'}))
  })

  test('should handle cookie expiration errors', async () => {
    const event = createSQSEvent('test-video-cookie')
    fetchVideoInfoMock.mockResolvedValue(createFailureResult(new CookieExpirationError('Sign in to confirm'), true))

    const output = await handler(event, context)

    // Cookie errors are permanent (require manual intervention)
    expect(output.batchItemFailures).toHaveLength(1)

    // Verify DownloadFailed event was published with correct category
    expect(publishEventMock).toHaveBeenCalledWith('DownloadFailed', expect.objectContaining({fileId: 'test-video-cookie', category: 'cookie_expired'}))
  })

  test('should dispatch MetadataNotifications to all waiting users after fetchVideoInfo', async () => {
    const event = createSQSEvent('test-video-multiuser')
    userFilesMock.mocks.query.byFile!.go.mockResolvedValue({data: [{userId: 'user-1'}, {userId: 'user-2'}, {userId: 'user-3'}]})
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'test-video-multiuser', title: 'Test Video', uploader: 'Test Uploader'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 82784319, s3Url: 's3://test-bucket/test-video.mp4', duration: 45})

    const output = await handler(event, context)

    expect(output.batchItemFailures).toEqual([])

    // Verify UserFiles.query.byFile was called
    expect(userFilesMock.mocks.query.byFile!.go).toHaveBeenCalled()

    // Verify sendMessage was called 3 times (once per user)
    expect(sendMessageMock).toHaveBeenCalledTimes(3)

    // Verify sendMessage was called with correct parameters
    const firstCall = sendMessageMock.mock.calls[0] as unknown as [
      {QueueUrl: string; MessageBody: string; MessageAttributes: {notificationType: {StringValue: string}}}
    ]
    expect(firstCall[0].QueueUrl).toBe('https://sqs.us-west-2.amazonaws.com/123456789/SendPushNotification')
    expect(firstCall[0].MessageBody).toContain('MetadataNotification')
    expect(firstCall[0].MessageAttributes.notificationType.StringValue).toBe('MetadataNotification')
  })

  test('should skip MetadataNotification when no users are waiting', async () => {
    const event = createSQSEvent('test-video-nouser')
    userFilesMock.mocks.query.byFile!.go.mockResolvedValue({data: []})
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'test-video-nouser'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 82784319, s3Url: 's3://test-bucket/test-video.mp4', duration: 45})

    const output = await handler(event, context)

    expect(output.batchItemFailures).toEqual([])

    // Verify sendMessage was NOT called (no users to notify)
    expect(sendMessageMock).not.toHaveBeenCalled()
  })
})
