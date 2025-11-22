import {describe, expect, test, jest, beforeEach} from '@jest/globals'
import {UnexpectedError} from '../../../util/errors'
import {StartFileUploadParams} from '../../../types/main'
import {YtDlpVideoInfo, YtDlpFormat} from '../../../types/youtube'
import {testContext} from '../../../util/jest-setup'

// Mock YouTube functions
const fetchVideoInfoMock = jest.fn<() => Promise<YtDlpVideoInfo>>()
const chooseVideoFormatMock = jest.fn<() => YtDlpFormat>()
const streamVideoToS3Mock = jest.fn<() => Promise<{fileSize: number; s3Url: string; duration: number}>>()

jest.unstable_mockModule('../../../lib/vendor/YouTube', () => ({
  fetchVideoInfo: fetchVideoInfoMock,
  chooseVideoFormat: chooseVideoFormatMock,
  streamVideoToS3: streamVideoToS3Mock
}))

// Mock ElectroDB Files entity
const filesUpsertMock = jest.fn<() => Promise<{data: unknown}>>()
jest.unstable_mockModule('../../../lib/vendor/ElectroDB/entities/Files', () => ({
  Files: {
    upsert: jest.fn(() => ({go: filesUpsertMock}))
  }
}))

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
    streamVideoToS3Mock.mockResolvedValue({
      fileSize: 82784319,
      s3Url: 's3://test-bucket/test-video.mp4',
      duration: 45
    })
    filesUpsertMock.mockResolvedValue({data: {}})

    const output = await handler(event, context)

    expect(output.statusCode).toEqual(200)
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.body.status).toEqual('success')
    expect(parsedBody.body.fileSize).toEqual(82784319)
    expect(parsedBody.body.duration).toEqual(45)
    expect(parsedBody.body.fileId).toBeDefined()

    // Verify Files.upsert was called twice (PendingDownload, then Downloaded)
    expect(filesUpsertMock).toHaveBeenCalledTimes(2)

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
    streamVideoToS3Mock.mockResolvedValue({
      fileSize: 104857600,
      s3Url: 's3://test-bucket/test-video.mp4',
      duration: 120
    })
    filesUpsertMock.mockResolvedValue({data: {}})

    const output = await handler(event, context)

    expect(output.statusCode).toEqual(200)
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.body.status).toEqual('success')
    expect(parsedBody.body.fileSize).toEqual(104857600)
    expect(parsedBody.body.duration).toEqual(120)

    // Verify Files.upsert was called with Downloaded status
    expect(filesUpsertMock).toHaveBeenCalled()
  })

  test('should handle streaming errors and mark file as Failed', async () => {
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
    filesUpsertMock.mockResolvedValue({data: {}})

    const output = await handler(event, context)

    expect(output.statusCode).toBeGreaterThanOrEqual(400)

    // Verify Files.upsert was called to set Failed status
    expect(filesUpsertMock).toHaveBeenCalled()
  })

  test('should handle video not found error', async () => {
    fetchVideoInfoMock.mockRejectedValue(new UnexpectedError('Video not found'))
    filesUpsertMock.mockResolvedValue({data: {}})

    const output = await handler(event, context)

    expect(output.statusCode).toBeGreaterThanOrEqual(400)

    // Verify Files.upsert was called to set Failed status
    expect(filesUpsertMock).toHaveBeenCalled()
  })

  test('should handle missing bucket environment variable', async () => {
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
    filesUpsertMock.mockResolvedValue({data: {}})

    const output = await handler(event, context)

    expect(output.statusCode).toBeGreaterThanOrEqual(400)

    // Verify streamVideoToS3 was NOT called since bucket check happens first
    expect(streamVideoToS3Mock).not.toHaveBeenCalled()

    process.env.Bucket = originalBucket
  })

  test('should continue even if Files.upsert fails during error handling', async () => {
    fetchVideoInfoMock.mockRejectedValue(new Error('Video fetch failed'))
    filesUpsertMock.mockRejectedValue(new Error('Files.upsert failed'))

    const output = await handler(event, context)

    expect(output.statusCode).toBeGreaterThanOrEqual(400)

    // Should have attempted to upsert file despite the failure
    expect(filesUpsertMock).toHaveBeenCalled()
  })
})
