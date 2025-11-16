import {describe, expect, test, jest, beforeEach} from '@jest/globals'
import {UnexpectedError} from '../../../util/errors'
import {StartFileUploadParams} from '../../../types/main'
import {FileStatus} from '../../../types/enums'

// Mock S3Client
const mockS3Client = jest.fn()
jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: mockS3Client
}))

// Mock YouTube functions
const fetchVideoInfoMock = jest.fn<() => Promise<unknown>>()
const chooseVideoFormatMock = jest.fn<() => unknown>()
const streamVideoToS3Mock = jest.fn<() => Promise<{fileSize: number; s3Url: string; duration: number}>>()
const {default: fetchVideoInfoResponse} = await import('./fixtures/fetchVideoInfo-200-OK.json', {assert: {type: 'json'}})

jest.unstable_mockModule('../../../lib/vendor/YouTube', () => ({
  fetchVideoInfo: fetchVideoInfoMock,
  chooseVideoFormat: chooseVideoFormatMock,
  streamVideoToS3: streamVideoToS3Mock
}))

// Mock DynamoDB
const updateItemMock = jest.fn<() => Promise<unknown>>()
jest.unstable_mockModule('../../../lib/vendor/AWS/DynamoDB', () => ({
  updateItem: updateItemMock,
  deleteItem: jest.fn(),
  query: jest.fn(),
  scan: jest.fn()
}))

const {default: eventMock} = await import('./fixtures/startFileUpload-200-OK.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#StartFileUpload', () => {
  const event = eventMock as StartFileUploadParams

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.Bucket = 'test-bucket'
    process.env.AWS_REGION = 'us-west-2'
    process.env.DynamoDBTableFiles = 'test-table'
  })

  test('should successfully stream video to S3', async () => {
    const mockFormat = {
      ...fetchVideoInfoResponse.formats[0],
      ext: 'mp4'
    }
    const mockVideoInfo = {
      ...fetchVideoInfoResponse,
      id: 'test-video-id',
      title: 'Test Video'
    }
    fetchVideoInfoMock.mockResolvedValue(mockVideoInfo)
    chooseVideoFormatMock.mockReturnValue(mockFormat)
    streamVideoToS3Mock.mockResolvedValue({
      fileSize: 82784319,
      s3Url: 's3://test-bucket/test-video.mp4',
      duration: 45
    })
    updateItemMock.mockResolvedValue({})

    const output = await handler(event)

    expect(output.status).toEqual('success')
    expect(output.fileSize).toEqual(82784319)
    expect(output.duration).toEqual(45)
    expect(output.fileId).toBeDefined()

    // Verify DynamoDB was called twice (PendingDownload, then Downloaded)
    expect(updateItemMock).toHaveBeenCalledTimes(2)

    // Verify status updates (Document Client uses plain objects, not .S/.N format)
    // @ts-expect-error - mock.calls type inference issue
    const firstCall = updateItemMock.mock.calls[0][0] as Record<string, unknown>
    expect(firstCall.ExpressionAttributeValues).toMatchObject({':status': FileStatus.PendingDownload})

    // Second call should update status to Downloaded with file size
    // @ts-expect-error - mock.calls type inference issue
    const secondCall = updateItemMock.mock.calls[1][0] as Record<string, unknown>
    expect(secondCall.ExpressionAttributeValues).toMatchObject({
      ':status': FileStatus.Downloaded,
      ':size': 82784319
    })

    // Verify streamVideoToS3 was called with correct parameters
    expect(streamVideoToS3Mock).toHaveBeenCalledWith(
      expect.stringContaining('youtube.com/watch?v='),
      expect.anything(), // S3Client
      'test-bucket',
      expect.stringMatching(/\.mp4$/)
    )
  })

  test('should handle HLS/DASH streaming formats', async () => {
    const hlsFormat = {
      ...fetchVideoInfoResponse.formats[0],
      url: 'https://manifest.googlevideo.com/api/manifest.m3u8',
      filesize: undefined,
      ext: 'mp4'
    }

    const mockVideoInfo = {
      ...fetchVideoInfoResponse,
      id: 'test-video-hls',
      title: 'Test HLS Video'
    }
    fetchVideoInfoMock.mockResolvedValue(mockVideoInfo)
    chooseVideoFormatMock.mockReturnValue(hlsFormat)
    streamVideoToS3Mock.mockResolvedValue({
      fileSize: 104857600,
      s3Url: 's3://test-bucket/test-video.mp4',
      duration: 120
    })
    updateItemMock.mockResolvedValue({})

    const output = await handler(event)

    expect(output.status).toEqual('success')
    expect(output.fileSize).toEqual(104857600)
    expect(output.duration).toEqual(120)

    // Verify DynamoDB was updated with Downloaded status
    // @ts-expect-error - mock.calls type inference issue
    const secondCall = updateItemMock.mock.calls[1][0] as Record<string, unknown>
    expect(secondCall.ExpressionAttributeValues).toMatchObject({':status': FileStatus.Downloaded})
  })

  test('should handle streaming errors and mark file as Failed', async () => {
    const mockFormat = {
      ...fetchVideoInfoResponse.formats[0],
      ext: 'mp4'
    }
    const mockVideoInfo = {
      ...fetchVideoInfoResponse,
      id: 'test-video-error',
      title: 'Test Error Video'
    }
    fetchVideoInfoMock.mockResolvedValue(mockVideoInfo)
    chooseVideoFormatMock.mockReturnValue(mockFormat)
    streamVideoToS3Mock.mockRejectedValue(new Error('Stream upload failed'))
    updateItemMock.mockResolvedValue({})

    await expect(handler(event)).rejects.toThrow('File upload failed')

    // Verify DynamoDB was called to set Failed status
    expect(updateItemMock).toHaveBeenCalled()
    const calls = updateItemMock.mock.calls
    // @ts-expect-error - mock.calls type inference issue
    const lastCall = calls[calls.length - 1][0] as Record<string, unknown>
    expect(lastCall.ExpressionAttributeValues).toMatchObject({':status': FileStatus.Failed})
  })

  test('should handle video not found error', async () => {
    fetchVideoInfoMock.mockRejectedValue(new UnexpectedError('Video not found'))
    updateItemMock.mockResolvedValue({})

    await expect(handler(event)).rejects.toThrow('File upload failed')

    // Verify DynamoDB was called to set Failed status
    const calls = updateItemMock.mock.calls
    // @ts-expect-error - mock.calls type inference issue
    const lastCall = calls[calls.length - 1][0] as Record<string, unknown>
    expect(lastCall.ExpressionAttributeValues).toMatchObject({':status': FileStatus.Failed})
  })

  test('should handle missing bucket environment variable', async () => {
    const originalBucket = process.env.Bucket
    process.env.Bucket = '' // Empty string also triggers the check
    const mockFormat = {
      ...fetchVideoInfoResponse.formats[0],
      ext: 'mp4'
    }
    const mockVideoInfo = {
      ...fetchVideoInfoResponse,
      id: 'test-video-no-bucket',
      title: 'Test No Bucket Video'
    }
    fetchVideoInfoMock.mockResolvedValue(mockVideoInfo)
    chooseVideoFormatMock.mockReturnValue(mockFormat)
    updateItemMock.mockResolvedValue({})

    await expect(handler(event)).rejects.toThrow('Bucket environment variable not set')

    // Verify streamVideoToS3 was NOT called since bucket check happens first
    expect(streamVideoToS3Mock).not.toHaveBeenCalled()

    process.env.Bucket = originalBucket
  })

  test('should continue even if DynamoDB update fails during error handling', async () => {
    fetchVideoInfoMock.mockRejectedValue(new Error('Video fetch failed'))
    updateItemMock.mockRejectedValue(new Error('DynamoDB update failed'))

    await expect(handler(event)).rejects.toThrow('File upload failed')

    // Should have attempted to update DynamoDB despite the failure
    expect(updateItemMock).toHaveBeenCalled()
  })
})
