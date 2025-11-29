/**
 * Mock YouTube Helper
 *
 * Mocks yt-dlp vendor wrapper for integration tests.
 * This allows testing Lambda orchestration logic without running actual yt-dlp binary.
 */

import {Readable} from 'stream'
import {jest} from '@jest/globals'
import {YtDlpVideoInfo, YtDlpFormat} from '../../../src/types/youtube'

/**
 * Create mock video info for testing
 */
export function createMockVideoInfo(overrides?: Partial<YtDlpVideoInfo>): YtDlpVideoInfo {
  const defaultFormat: YtDlpFormat = {
    format_id: '18',
    ext: 'mp4',
    url: 'https://mock-youtube.com/video.mp4',
    filesize: 5242880, // 5MB
    vcodec: 'avc1.42001E',
    acodec: 'mp4a.40.2',
    width: 640,
    height: 360,
    fps: 30,
    tbr: 500
  }

  return {
    id: 'test-video-123',
    title: 'Test Video Title',
    thumbnail: 'https://mock-youtube.com/thumbnail.jpg',
    uploader: 'Test Channel',
    upload_date: '20240101',
    description: 'Test video description',
    duration: 120,
    formats: [defaultFormat],
    ...overrides
  }
}

/**
 * Create mock video format for testing
 */
export function createMockVideoFormat(overrides?: Partial<YtDlpFormat>): YtDlpFormat {
  return {
    format_id: '18',
    ext: 'mp4',
    url: 'https://mock-youtube.com/video.mp4',
    filesize: 5242880, // 5MB
    vcodec: 'avc1.42001E',
    acodec: 'mp4a.40.2',
    width: 640,
    height: 360,
    fps: 30,
    tbr: 500,
    ...overrides
  }
}

/**
 * Create a mock video stream for testing S3 uploads
 * @param sizeInBytes - Size of the mock video in bytes
 * @param contentPattern - Pattern to fill the stream with (default: 'a')
 */
export function createMockVideoStream(sizeInBytes: number, contentPattern: string = 'a'): Readable {
  let bytesWritten = 0
  const chunkSize = 64 * 1024 // 64KB chunks

  return new Readable({
    read() {
      if (bytesWritten >= sizeInBytes) {
        this.push(null) // End of stream
        return
      }

      const remainingBytes = sizeInBytes - bytesWritten
      const bytesToWrite = Math.min(chunkSize, remainingBytes)

      // Create chunk filled with pattern
      const chunk = Buffer.alloc(bytesToWrite, contentPattern)

      bytesWritten += bytesToWrite
      this.push(chunk)
    }
  })
}

/**
 * Mock streamVideoToS3 result
 */
export function createMockStreamResult(sizeInBytes: number): {
  fileSize: number
  s3Url: string
  duration: number
} {
  return {
    fileSize: sizeInBytes,
    s3Url: 's3://test-bucket/test-video.mp4',
    duration: 1500 // 1.5 seconds
  }
}

/**
 * Create mock implementation of fetchVideoInfo
 */
export function mockFetchVideoInfo(videoInfo?: YtDlpVideoInfo): jest.Mock {
  return jest.fn<() => Promise<YtDlpVideoInfo>>().mockResolvedValue(videoInfo || createMockVideoInfo())
}

/**
 * Create mock implementation of chooseVideoFormat
 */
export function mockChooseVideoFormat(format?: YtDlpFormat): jest.Mock {
  return jest.fn<() => YtDlpFormat>().mockReturnValue(format || createMockVideoFormat())
}

/**
 * S3 Upload interface for integration testing.
 * Uses Promise<unknown> for done() to be compatible with @aws-sdk/lib-storage Upload class
 * which returns Promise<CompleteMultipartUploadCommandOutput>.
 */
export interface S3UploadHandle {
  done: () => Promise<unknown>
}

/**
 * S3 Upload function type for integration testing.
 * This type is used for type assertions when passing the real createS3Upload
 * function to mocks that have a simpler type signature.
 */
export type S3UploadFunction = (bucket: string, key: string, body: Readable | Buffer, contentType?: string) => S3UploadHandle

/**
 * Create mock implementation of streamVideoToS3 that actually uploads to S3
 * This is used for REAL S3 uploads in integration tests.
 *
 * @param createS3Upload - S3 upload function. Use type assertion (createS3Upload as S3UploadFunction)
 *                         when passing the real createS3Upload which has additional optional parameters.
 */
export function createMockStreamVideoToS3WithRealUpload(createS3Upload: S3UploadFunction) {
  return jest.fn(async (_uri: string, bucket: string, key: string) => {
    // Create mock video stream
    const videoStream = createMockVideoStream(5242880) // 5MB

    // Use REAL S3 upload (LocalStack)
    const upload = createS3Upload(bucket, key, videoStream, 'video/mp4')
    await upload.done()

    return {
      fileSize: 5242880,
      s3Url: `s3://${bucket}/${key}`,
      duration: 1500
    }
  })
}

/**
 * Create mock implementation of streamVideoToS3 that fails for testing error handling
 */
export function createMockStreamVideoToS3WithFailure(errorMessage: string = 'Mock S3 upload failed'): jest.Mock {
  return jest.fn<() => Promise<never>>().mockRejectedValue(new Error(errorMessage))
}
