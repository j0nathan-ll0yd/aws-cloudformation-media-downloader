import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import {UnexpectedError} from '#util/errors'
import {StartFileUploadParams} from '#types/main'
import {YtDlpFormat, YtDlpVideoInfo} from '#types/youtube'
import {testContext} from '#util/jest-setup'
import {createElectroDBEntityMock} from '#test/helpers/electrodb-mock'

// Mock YouTube functions
const fetchVideoInfoMock = jest.fn<() => Promise<YtDlpVideoInfo>>()
const fetchVideoInfoSafeMock = jest.fn<() => Promise<YtDlpVideoInfo | undefined>>()
const chooseVideoFormatMock = jest.fn<() => YtDlpFormat>()
const streamVideoToS3Mock = jest.fn<() => Promise<{fileSize: number; s3Url: string; duration: number}>>()

jest.unstable_mockModule('#lib/vendor/YouTube',
  () => ({
    fetchVideoInfo: fetchVideoInfoMock,
    fetchVideoInfoSafe: fetchVideoInfoSafeMock,
    chooseVideoFormat: chooseVideoFormatMock,
    streamVideoToS3: streamVideoToS3Mock
  }))

// Mock ElectroDB Files entity
const filesMock = createElectroDBEntityMock()
jest.unstable_mockModule('#entities/Files', () => ({Files: filesMock.entity}))

const {default: eventMock} = await import('./fixtures/startFileUpload-200-OK.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#StartFileUpload', () => {
  const context = testContext
  let event: StartFileUploadParams

  beforeEach(() => {
    // Deep clone event to prevent test interference
    event = JSON.parse(JSON.stringify(eventMock))

    // Reset mocks
    jest.clearAllMocks()

    // Set default mock return values for error handling path
    fetchVideoInfoSafeMock.mockResolvedValue(undefined)
    filesMock.mocks.get.mockResolvedValue({data: null})

    // Set environment variables
    process.env.Bucket = 'test-bucket'
    process.env.AWS_REGION = 'us-west-2'
    process.env.DynamoDBTableFiles = 'test-table'
  })

  test('should successfully stream video to S3', async () => {
    const mockFormat = {
      format_id: '22',
      url: 'https://example.com/video.mp4',
      ext: 'mp4',
      filesize: 44992120,
      width: 1280,
      height: 720,
      vcodec: 'avc1.64001F',
      acodec: 'mp4a.40.2',
      tbr: 1080
    } as YtDlpFormat
    const mockVideoInfo = {
      id: 'test-video-id',
      title: 'Test Video',
      thumbnail: 'https://example.com/thumbnail.jpg',
      duration: 300,
      formats: [mockFormat]
    } as YtDlpVideoInfo
    fetchVideoInfoMock.mockResolvedValue(mockVideoInfo)
    chooseVideoFormatMock.mockReturnValue(mockFormat)
    streamVideoToS3Mock.mockResolvedValue({fileSize: 82784319, s3Url: 's3://test-bucket/test-video.mp4', duration: 45})
    filesMock.mocks.upsert.go.mockResolvedValue({data: {}})

    const output = await handler(event, context)

    expect(output.statusCode).toEqual(200)
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.body.status).toEqual('Success')
    expect(parsedBody.body.fileSize).toEqual(82784319)
    expect(parsedBody.body.duration).toEqual(45)
    expect(parsedBody.body.fileId).toBeDefined()

    // Verify Files.upsert was called twice (PendingDownload, then Downloaded)
    expect(filesMock.mocks.upsert.go).toHaveBeenCalledTimes(2)

    // Verify streamVideoToS3 was called with correct parameters
    expect(streamVideoToS3Mock).toHaveBeenCalledWith(expect.stringContaining('youtube.com/watch?v='), 'test-bucket', expect.stringMatching(/\.mp4$/))
  })

  test('should handle HLS/DASH streaming formats', async () => {
    const hlsFormat = {
      format_id: 'hls-720',
      url: 'https://manifest.googlevideo.com/api/manifest.m3u8',
      ext: 'mp4',
      filesize: undefined,
      width: 1280,
      height: 720,
      vcodec: 'avc1.64001F',
      acodec: 'mp4a.40.2',
      tbr: 1080
    } as YtDlpFormat

    const mockVideoInfo = {
      id: 'test-video-hls',
      title: 'Test HLS Video',
      thumbnail: 'https://example.com/thumbnail.jpg',
      duration: 300,
      formats: [hlsFormat]
    } as YtDlpVideoInfo
    fetchVideoInfoMock.mockResolvedValue(mockVideoInfo)
    chooseVideoFormatMock.mockReturnValue(hlsFormat)
    streamVideoToS3Mock.mockResolvedValue({fileSize: 104857600, s3Url: 's3://test-bucket/test-video.mp4', duration: 120})
    filesMock.mocks.upsert.go.mockResolvedValue({data: {}})

    const output = await handler(event, context)

    expect(output.statusCode).toEqual(200)
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.body.status).toEqual('Success')
    expect(parsedBody.body.fileSize).toEqual(104857600)
    expect(parsedBody.body.duration).toEqual(120)

    // Verify Files.upsert was called with Downloaded status
    expect(filesMock.mocks.upsert.go).toHaveBeenCalled()
  })

  test('should schedule retry for transient streaming errors', async () => {
    const mockFormat = {
      format_id: '22',
      url: 'https://example.com/video.mp4',
      ext: 'mp4',
      filesize: 44992120,
      width: 1280,
      height: 720,
      vcodec: 'avc1.64001F',
      acodec: 'mp4a.40.2',
      tbr: 1080
    } as YtDlpFormat
    const mockVideoInfo = {
      id: 'test-video-error',
      title: 'Test Error Video',
      thumbnail: 'https://example.com/thumbnail.jpg',
      duration: 300,
      formats: [mockFormat]
    } as YtDlpVideoInfo
    fetchVideoInfoMock.mockResolvedValue(mockVideoInfo)
    chooseVideoFormatMock.mockReturnValue(mockFormat)
    streamVideoToS3Mock.mockRejectedValue(new Error('Stream upload failed'))
    filesMock.mocks.upsert.go.mockResolvedValue({data: {}})

    const output = await handler(event, context)

    // Transient errors now get scheduled for retry (200) instead of immediate failure
    expect(output.statusCode).toEqual(200)
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.body.status).toEqual('scheduled')
    expect(parsedBody.body.retryAfter).toBeDefined()

    // Verify Files.upsert was called to set Scheduled status
    expect(filesMock.mocks.upsert.go).toHaveBeenCalled()
  })

  test('should mark file as Failed for permanent errors (video private)', async () => {
    fetchVideoInfoMock.mockRejectedValue(new Error('This video is private'))
    filesMock.mocks.upsert.go.mockResolvedValue({data: {}})

    const output = await handler(event, context)

    // Permanent errors still return error status codes
    expect(output.statusCode).toBeGreaterThanOrEqual(400)

    // Verify Files.upsert was called to set Failed status
    expect(filesMock.mocks.upsert.go).toHaveBeenCalled()
  })

  test('should schedule retry for unknown errors (benefit of doubt)', async () => {
    // Unknown errors are treated as transient (retryable) by default
    fetchVideoInfoMock.mockRejectedValue(new UnexpectedError('Video not found'))
    filesMock.mocks.upsert.go.mockResolvedValue({data: {}})

    const output = await handler(event, context)

    // Unknown errors get scheduled for retry
    expect(output.statusCode).toEqual(200)
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.body.status).toEqual('scheduled')

    // Verify Files.upsert was called to set Scheduled status
    expect(filesMock.mocks.upsert.go).toHaveBeenCalled()
  })

  test('should schedule retry for missing bucket environment variable', async () => {
    const originalBucket = process.env.Bucket
    process.env.Bucket = '' // Empty string also triggers the check
    const mockFormat = {
      format_id: '22',
      url: 'https://example.com/video.mp4',
      ext: 'mp4',
      filesize: 44992120,
      width: 1280,
      height: 720,
      vcodec: 'avc1.64001F',
      acodec: 'mp4a.40.2',
      tbr: 1080
    } as YtDlpFormat
    const mockVideoInfo = {
      id: 'test-video-no-bucket',
      title: 'Test No Bucket Video',
      thumbnail: 'https://example.com/thumbnail.jpg',
      duration: 300,
      formats: [mockFormat]
    } as YtDlpVideoInfo
    fetchVideoInfoMock.mockResolvedValue(mockVideoInfo)
    chooseVideoFormatMock.mockReturnValue(mockFormat)
    filesMock.mocks.upsert.go.mockResolvedValue({data: {}})

    const output = await handler(event, context)

    // Configuration errors are treated as transient (will be retried when config is fixed)
    expect(output.statusCode).toEqual(200)
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.body.status).toEqual('scheduled')

    // Verify streamVideoToS3 was NOT called since bucket check happens first
    expect(streamVideoToS3Mock).not.toHaveBeenCalled()

    process.env.Bucket = originalBucket
  })

  test('should fall through to failure handling if Files.upsert fails during retry scheduling', async () => {
    fetchVideoInfoMock.mockRejectedValue(new Error('Video fetch failed'))
    // First upsert (for scheduled) fails, second upsert (for failed) also fails
    filesMock.mocks.upsert.go.mockRejectedValue(new Error('Files.upsert failed'))

    const output = await handler(event, context)

    // Falls through to error response when upsert fails
    expect(output.statusCode).toBeGreaterThanOrEqual(400)

    // Should have attempted to upsert file (possibly multiple times: scheduled then failed)
    expect(filesMock.mocks.upsert.go).toHaveBeenCalled()
  })

  test('should mark file as Failed when max retries exceeded', async () => {
    fetchVideoInfoMock.mockRejectedValue(new Error('Stream upload failed'))
    // Simulate a file that has already been retried 5 times
    filesMock.mocks.get.mockResolvedValue({data: {fileId: 'test', retryCount: 5, maxRetries: 5}})
    filesMock.mocks.upsert.go.mockResolvedValue({data: {}})

    const output = await handler(event, context)

    // Max retries exceeded should result in error
    expect(output.statusCode).toBeGreaterThanOrEqual(400)

    // Verify Files.upsert was called with Failed status
    expect(filesMock.mocks.upsert.go).toHaveBeenCalled()
  })
})
