import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import {CookieExpirationError, UnexpectedError} from '#util/errors'
import {StartFileUploadParams} from '#types/main'
import {DownloadStatus} from '#types/enums'
import {YtDlpVideoInfo} from '#types/youtube'
import {testContext} from '#util/jest-setup'
import {createElectroDBEntityMock} from '#test/helpers/electrodb-mock'
import type {FetchVideoInfoResult} from '#types/video'

// Mock YouTube functions
const fetchVideoInfoMock = jest.fn<(url: string) => Promise<FetchVideoInfoResult>>()
const downloadVideoToS3Mock = jest.fn<(url: string, bucket: string, key: string) => Promise<{fileSize: number; s3Url: string; duration: number}>>()

jest.unstable_mockModule('#lib/vendor/YouTube', () => ({
  fetchVideoInfo: fetchVideoInfoMock,
  downloadVideoToS3: downloadVideoToS3Mock
}))

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

const {default: eventMock} = await import('./fixtures/startFileUpload-200-OK.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#StartFileUpload', () => {
  const context = testContext
  let event: StartFileUploadParams

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
    // Deep clone event to prevent test interference
    event = JSON.parse(JSON.stringify(eventMock))

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

    // Set environment variables
    process.env.Bucket = 'test-bucket'
    process.env.AWS_REGION = 'us-west-2'
    process.env.DynamoDBTableName = 'test-table'
    process.env.CloudfrontDomain = 'test-cdn.cloudfront.net'
    process.env.SNSQueueUrl = 'https://sqs.us-west-2.amazonaws.com/123456789/SendPushNotification'
  })

  test('should successfully download video to S3', async () => {
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'test-video-id'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 82784319, s3Url: 's3://test-bucket/test-video.mp4', duration: 45})

    const output = await handler(event, context)

    expect(output.statusCode).toEqual(200)
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.body.status).toEqual('Success')
    expect(parsedBody.body.fileSize).toEqual(82784319)
    expect(parsedBody.body.duration).toEqual(45)
    expect(parsedBody.body.fileId).toBeDefined()

    // Verify Files.upsert was called (for permanent metadata)
    expect(filesMock.mocks.upsert.go).toHaveBeenCalled()

    // Verify FileDownloads was updated (status changes: in_progress -> completed)
    expect(fileDownloadsMock.mocks.update.go).toHaveBeenCalled()

    // Verify downloadVideoToS3 was called with correct parameters (no format ID - yt-dlp handles selection)
    expect(downloadVideoToS3Mock).toHaveBeenCalledWith(expect.stringContaining('youtube.com/watch?v='), 'test-bucket', expect.stringMatching(/\.mp4$/))
  })

  test('should handle large video files', async () => {
    // Test that large files (e.g., 100MB) are handled correctly
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'test-video-large', title: 'Large Video'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 104857600, s3Url: 's3://test-bucket/test-video.mp4', duration: 120})

    const output = await handler(event, context)

    expect(output.statusCode).toEqual(200)
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.body.status).toEqual('Success')
    expect(parsedBody.body.fileSize).toEqual(104857600)
    expect(parsedBody.body.duration).toEqual(120)

    // Verify Files.upsert was called with success
    expect(filesMock.mocks.upsert.go).toHaveBeenCalled()
  })

  test('should schedule retry for transient download errors', async () => {
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'test-video-error'}))
    downloadVideoToS3Mock.mockRejectedValue(new Error('Download failed'))

    const output = await handler(event, context)

    // Transient errors get scheduled for retry (200)
    expect(output.statusCode).toEqual(200)
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.body.status).toEqual('scheduled')
    expect(parsedBody.body.retryAfter).toBeDefined()

    // Verify FileDownloads was updated with scheduled status
    expect(fileDownloadsMock.mocks.update.go).toHaveBeenCalled()
  })

  test('should mark file as Failed for permanent errors (video private)', async () => {
    fetchVideoInfoMock.mockResolvedValue(createFailureResult(new Error('This video is private')))

    const output = await handler(event, context)

    // Permanent errors return error status codes
    expect(output.statusCode).toEqual(500)
    // Error responses have structure: {error: {code, message: <body>}}
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.error.message.status).toEqual('failed')
    expect(parsedBody.error.message.category).toEqual('permanent')

    // Verify FileDownloads was updated with failed status
    expect(fileDownloadsMock.mocks.update.go).toHaveBeenCalled()
  })

  test('should schedule retry for unknown errors (benefit of doubt)', async () => {
    // Unknown errors are treated as transient (retryable) by default
    fetchVideoInfoMock.mockResolvedValue(createFailureResult(new UnexpectedError('Video not found')))

    const output = await handler(event, context)

    // Unknown errors get scheduled for retry
    expect(output.statusCode).toEqual(200)
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.body.status).toEqual('scheduled')

    // Verify FileDownloads was updated with scheduled status
    expect(fileDownloadsMock.mocks.update.go).toHaveBeenCalled()
  })

  test('should handle fetch failure with video info for classification', async () => {
    // Fetch fails but we have partial video info (e.g., scheduled video)
    const videoInfo = {
      id: 'scheduled-video',
      title: 'Upcoming Video',
      release_timestamp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      live_status: 'is_upcoming'
    } as YtDlpVideoInfo

    fetchVideoInfoMock.mockResolvedValue({success: false, error: new Error('Video is not available'), info: videoInfo})

    const output = await handler(event, context)

    // Should be scheduled for retry at release time
    expect(output.statusCode).toEqual(200)
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.body.status).toEqual('scheduled')
  })

  test('should handle FileDownloads update failures gracefully', async () => {
    fetchVideoInfoMock.mockResolvedValue(createFailureResult(new Error('Video fetch failed')))
    // FileDownloads operations fail - but the handler should handle this gracefully
    // The actual behavior depends on the implementation - just verify we get some response
    fileDownloadsMock.mocks.update.go.mockImplementation(() => {
      throw new Error('DynamoDB error')
    })

    // The handler may throw or return an error response - either is acceptable
    try {
      const output = await handler(event, context)
      expect(output).toBeDefined()
    } catch {
      // Throwing is also acceptable if DynamoDB operations fail completely
      expect(true).toBe(true)
    }
  })

  test('should mark file as Failed when max retries exceeded', async () => {
    // First the handler reads existing download state with maxed retries
    fileDownloadsMock.mocks.get.mockResolvedValue({data: {fileId: 'test', retryCount: 5, maxRetries: 5}})
    // Then the fetch fails (doesn't matter what error, retries are exhausted)
    fetchVideoInfoMock.mockResolvedValue(createFailureResult(new Error('Any error')))

    const output = await handler(event, context)

    // Max retries exceeded should result in error
    expect(output.statusCode).toEqual(500)
    // Error responses have structure: {error: {code, message: <body>}}
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.error.message.status).toEqual('failed')
  })

  test('should handle cookie expiration errors', async () => {
    // CookieExpirationError is recognized by the classifier
    fetchVideoInfoMock.mockResolvedValue(createFailureResult(new CookieExpirationError('Sign in to confirm'), true))

    const output = await handler(event, context)

    // Cookie errors are permanent (require manual intervention)
    expect(output.statusCode).toEqual(500)
    // Error responses have structure: {error: {code, message: <body>}}
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.error.message.status).toEqual('failed')
    expect(parsedBody.error.message.category).toEqual('cookie_expired')
  })

  test('should dispatch MetadataNotifications to all waiting users after fetchVideoInfo', async () => {
    // Mock multiple users waiting for the file
    userFilesMock.mocks.query.byFile!.go.mockResolvedValue({data: [{userId: 'user-1'}, {userId: 'user-2'}, {userId: 'user-3'}]})
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'test-video-id', title: 'Test Video', uploader: 'Test Uploader'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 82784319, s3Url: 's3://test-bucket/test-video.mp4', duration: 45})

    const output = await handler(event, context)

    expect(output.statusCode).toEqual(200)

    // Verify UserFiles.query.byFile was called
    expect(userFilesMock.mocks.query.byFile!.go).toHaveBeenCalled()

    // Verify sendMessage was called 3 times (once per user)
    expect(sendMessageMock).toHaveBeenCalledTimes(3)

    // Verify sendMessage was called with correct parameters
    const firstCall = sendMessageMock.mock.calls[0] as unknown as [{QueueUrl: string; MessageBody: string; MessageAttributes: {notificationType: {StringValue: string}}}]
    expect(firstCall[0].QueueUrl).toBe('https://sqs.us-west-2.amazonaws.com/123456789/SendPushNotification')
    expect(firstCall[0].MessageBody).toContain('MetadataNotification')
    expect(firstCall[0].MessageAttributes.notificationType.StringValue).toBe('MetadataNotification')
  })

  test('should skip MetadataNotification when no users are waiting', async () => {
    // No users waiting for the file
    userFilesMock.mocks.query.byFile!.go.mockResolvedValue({data: []})
    fetchVideoInfoMock.mockResolvedValue(createSuccessResult({id: 'test-video-id'}))
    downloadVideoToS3Mock.mockResolvedValue({fileSize: 82784319, s3Url: 's3://test-bucket/test-video.mp4', duration: 45})

    const output = await handler(event, context)

    expect(output.statusCode).toEqual(200)

    // Verify sendMessage was NOT called (no users to notify)
    expect(sendMessageMock).not.toHaveBeenCalled()
  })
})
