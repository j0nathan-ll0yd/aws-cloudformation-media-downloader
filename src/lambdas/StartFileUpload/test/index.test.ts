import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import type {SQSEvent, SQSRecord} from 'aws-lambda'
import {createEntityMock} from '#test/helpers/entity-mock'
import {DownloadStatus} from '#types/enums'
import type {FetchVideoInfoResult} from '#types/video'
import type {YtDlpVideoInfo} from '#types/youtube'
import {CookieExpirationError, UnexpectedError} from '#lib/system/errors'
import {testContext} from '#util/jest-setup'

/** Message body structure for DownloadQueue SQS messages */
interface DownloadQueueMessage {
  fileId: string
  sourceUrl?: string
  correlationId?: string
  userId?: string
  attempt?: number
}

/** Creates a single SQS record for testing */
function createSQSRecord(messageId: string, message: DownloadQueueMessage, baseRecord: SQSRecord): SQSRecord {
  return {
    ...baseRecord,
    messageId,
    body: JSON.stringify({
      fileId: message.fileId,
      sourceUrl: message.sourceUrl ?? `https://www.youtube.com/watch?v=${message.fileId}`,
      correlationId: message.correlationId ?? `corr-${message.fileId}`,
      userId: message.userId ?? 'user-123',
      attempt: message.attempt ?? 1
    })
  }
}

/** Creates a multi-record SQS event for batch processing tests */
function createMultiRecordEvent(messages: Array<{messageId: string} & DownloadQueueMessage>, baseRecord: SQSRecord): SQSEvent {
  return {Records: messages.map((msg) => createSQSRecord(msg.messageId, msg, baseRecord))}
}

// Mock YouTube functions
const fetchVideoInfoMock = jest.fn<(url: string) => Promise<FetchVideoInfoResult>>()
const downloadVideoToS3Mock = jest.fn<(url: string, bucket: string, key: string) => Promise<{fileSize: number; s3Url: string; duration: number}>>()

jest.unstable_mockModule('#lib/vendor/YouTube', () => ({fetchVideoInfo: fetchVideoInfoMock, downloadVideoToS3: downloadVideoToS3Mock}))

// Mock ElectroDB Files entity (for permanent metadata)
const filesMock = createEntityMock()
jest.unstable_mockModule('#entities/Files', () => ({Files: filesMock.entity}))

// Mock ElectroDB FileDownloads entity (for transient download state)
const fileDownloadsMock = createEntityMock()
jest.unstable_mockModule('#entities/FileDownloads', () => ({
  FileDownloads: fileDownloadsMock.entity,
  DownloadStatus // Re-export the real enum
}))

// Mock ElectroDB UserFiles entity (for querying users waiting for a file)
const userFilesMock = createEntityMock({queryIndexes: ['byFile']})
jest.unstable_mockModule('#entities/UserFiles', () => ({UserFiles: userFilesMock.entity}))

// Mock SQS sendMessage for MetadataNotification dispatch
const sendMessageMock = jest.fn<() => Promise<{MessageId: string}>>()
jest.unstable_mockModule('#lib/vendor/AWS/SQS',
  () => ({
    sendMessage: sendMessageMock,
    stringAttribute: (value: string) => ({DataType: 'String', StringValue: value}),
    numberAttribute: (value: number) => ({DataType: 'Number', StringValue: String(value)})
  }))

// Mock EventBridge for publishing DownloadCompleted/DownloadFailed events
const publishEventMock = jest.fn<(eventType: string, detail: unknown) => Promise<unknown>>()
jest.unstable_mockModule('#lib/vendor/AWS/EventBridge', () => ({publishEvent: publishEventMock}))

// Mock GitHub issue creation (for permanent failures)
jest.unstable_mockModule('#lib/integrations/github/issue-service',
  () => ({createCookieExpirationIssue: jest.fn(), createVideoDownloadFailureIssue: jest.fn()}))

const {default: eventMock} = await import('./fixtures/SQSEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

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

  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock)) as SQSEvent
    jest.clearAllMocks()

    fileDownloadsMock.mocks.get.mockResolvedValue({data: null})
    fileDownloadsMock.mocks.update.go.mockResolvedValue({data: {}})
    fileDownloadsMock.mocks.create.mockResolvedValue({data: {}})
    filesMock.mocks.upsert.go.mockResolvedValue({data: {}})
    userFilesMock.mocks.query.byFile!.go.mockResolvedValue({data: [{userId: 'user-123'}]})
    sendMessageMock.mockResolvedValue({MessageId: 'msg-123'})
    publishEventMock.mockResolvedValue({FailedEntryCount: 0, Entries: [{EventId: 'event-123'}]})

    process.env.BUCKET = 'test-bucket'
    process.env.AWS_REGION = 'us-west-2'
    process.env.DYNAMODB_TABLE_NAME = 'test-table'
    process.env.CLOUDFRONT_DOMAIN = 'test-cdn.cloudfront.net'
    process.env.SNS_QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/123456789/SendPushNotification'
    process.env.EVENT_BUS_NAME = 'MediaDownloader'
  })

  test('should successfully download video and return no failures', async () => {
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'YcuKhcqzt7w'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 82784319, s3Url: 's3://test-bucket/test-video.mp4', duration: 45})

    const result = await handler(event, context)

    expect(result.batchItemFailures).toEqual([])
    expect(filesMock.mocks.upsert.go).toHaveBeenCalled()
    expect(fileDownloadsMock.mocks.update.go).toHaveBeenCalled()
    expect(publishEventMock).toHaveBeenCalledWith('DownloadCompleted',
      expect.objectContaining({fileId: 'YcuKhcqzt7w', correlationId: 'corr-123', s3Key: expect.stringMatching(/\.mp4$/), fileSize: 82784319}))
  })

  test('should handle large video files', async () => {
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'YcuKhcqzt7w', title: 'Large Video'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 104857600, s3Url: 's3://test-bucket/test-video.mp4', duration: 120})

    const result = await handler(event, context)

    expect(result.batchItemFailures).toEqual([])
    expect(filesMock.mocks.upsert.go).toHaveBeenCalled()
  })

  test('should report batch failure for transient download errors', async () => {
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'YcuKhcqzt7w'}))
    downloadVideoToS3Mock.mockRejectedValue(new Error('Network timeout'))

    const result = await handler(event, context)

    // Transient errors should cause batch item failure for SQS retry
    expect(result.batchItemFailures).toEqual([{itemIdentifier: 'test-message-id-123'}])
    expect(publishEventMock).toHaveBeenCalledWith('DownloadFailed',
      expect.objectContaining({fileId: 'YcuKhcqzt7w', correlationId: 'corr-123', retryable: true}))
  })

  test('should not retry permanent errors (video private)', async () => {
    fetchVideoInfoMock.mockResolvedValue(createFailureResult(new Error('This video is private')))

    const result = await handler(event, context)

    // Permanent errors should NOT cause batch item failure - message should be removed
    expect(result.batchItemFailures).toEqual([])
    expect(publishEventMock).toHaveBeenCalledWith('DownloadFailed',
      expect.objectContaining({fileId: 'YcuKhcqzt7w', errorCategory: 'permanent', retryable: false}))
  })

  test('should retry unknown errors with benefit of doubt', async () => {
    fetchVideoInfoMock.mockResolvedValue(createFailureResult(new UnexpectedError('Unknown error occurred')))

    const result = await handler(event, context)

    // Unknown errors are treated as transient (retryable)
    expect(result.batchItemFailures).toEqual([{itemIdentifier: 'test-message-id-123'}])
    expect(publishEventMock).toHaveBeenCalledWith('DownloadFailed', expect.objectContaining({retryable: true}))
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
    fileDownloadsMock.mocks.get.mockResolvedValue({data: {fileId: 'test', retryCount: 5, maxRetries: 5}})
    fetchVideoInfoMock.mockResolvedValue(createFailureResult(new Error('Any error')))

    const result = await handler(event, context)

    // Max retries exceeded - should NOT retry (no batch item failure)
    expect(result.batchItemFailures).toEqual([])
    expect(publishEventMock).toHaveBeenCalledWith('DownloadFailed', expect.objectContaining({retryable: false}))
  })

  test('should not retry cookie expiration errors', async () => {
    fetchVideoInfoMock.mockResolvedValue(createFailureResult(new CookieExpirationError('Sign in to confirm'), true))

    const result = await handler(event, context)

    // Cookie errors are permanent - no retry
    expect(result.batchItemFailures).toEqual([])
    expect(publishEventMock).toHaveBeenCalledWith('DownloadFailed', expect.objectContaining({errorCategory: 'cookie_expired', retryable: false}))
  })

  test('should dispatch MetadataNotifications to all waiting users', async () => {
    userFilesMock.mocks.query.byFile!.go.mockResolvedValue({data: [{userId: 'user-1'}, {userId: 'user-2'}, {userId: 'user-3'}]})
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'YcuKhcqzt7w', title: 'Test Video', uploader: 'Test Uploader'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 82784319, s3Url: 's3://test-bucket/test-video.mp4', duration: 45})

    const result = await handler(event, context)

    expect(result.batchItemFailures).toEqual([])
    expect(userFilesMock.mocks.query.byFile!.go).toHaveBeenCalled()
    expect(sendMessageMock).toHaveBeenCalledTimes(3)
  })

  test('should skip MetadataNotification when no users are waiting', async () => {
    userFilesMock.mocks.query.byFile!.go.mockResolvedValue({data: []})
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'YcuKhcqzt7w'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 82784319, s3Url: 's3://test-bucket/test-video.mp4', duration: 45})

    const result = await handler(event, context)

    expect(result.batchItemFailures).toEqual([])
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  test('should process multiple SQS records in batch', async () => {
    const multiRecordEvent = createMultiRecordEvent([
      {messageId: 'msg-1', fileId: 'video-1'},
      {messageId: 'msg-2', fileId: 'video-2'}
    ], event.Records[0])

    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'video-1'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 1000, s3Url: 's3://test-bucket/video.mp4', duration: 10})

    const result = await handler(multiRecordEvent, context)

    expect(result.batchItemFailures).toEqual([])
    expect(fetchVideoInfoMock).toHaveBeenCalledTimes(2)
  })

  test('should report only failed records in batch', async () => {
    const multiRecordEvent = createMultiRecordEvent([
      {messageId: 'msg-success', fileId: 'video-1'},
      {messageId: 'msg-fail', fileId: 'video-2'}
    ], event.Records[0])

    // First succeeds, second fails with transient error
    fetchVideoInfoMock.mockResolvedValueOnce(createSuccessResult({id: 'video-1'})).mockResolvedValueOnce(createFailureResult(new Error('Network error')))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 1000, s3Url: 's3://test-bucket/video.mp4', duration: 10})

    const result = await handler(multiRecordEvent, context)

    // Only the failed record should be in batchItemFailures
    expect(result.batchItemFailures).toEqual([{itemIdentifier: 'msg-fail'}])
  })
})
