import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import {EventEmitter} from 'events'
import {Readable} from 'stream'

// Mock yt-dlp-wrap
const mockGetVideoInfo = jest.fn()
class MockYTDlpWrap {
  constructor(public binaryPath: string) {}
  getVideoInfo = mockGetVideoInfo
}
jest.unstable_mockModule('yt-dlp-wrap', () => ({default: MockYTDlpWrap}))

// Mock child_process - only yt-dlp spawning now (no ffmpeg)
const mockSpawn = jest.fn()
jest.unstable_mockModule('child_process', () => ({spawn: mockSpawn}))

// Helper to create mock yt-dlp process
interface MockProcess extends EventEmitter {
  stdout: Readable
  stderr: EventEmitter
  kill: jest.Mock
}

function createMockProcess(): MockProcess {
  const process = new EventEmitter() as MockProcess
  process.stdout = new Readable({read() {}})
  process.stderr = new EventEmitter()
  process.kill = jest.fn()
  return process
}

// Mock fs - for temp file operations
const mockCopyFile = jest.fn<(src: string, dest: string) => Promise<void>>()
const mockStat = jest.fn<(path: string) => Promise<{size: number}>>()
const mockUnlink = jest.fn<(path: string) => Promise<void>>()
const mockCreateReadStream = jest.fn()
jest.unstable_mockModule('fs/promises', () => ({copyFile: mockCopyFile, stat: mockStat, unlink: mockUnlink}))
jest.unstable_mockModule('fs', () => ({createReadStream: mockCreateReadStream}))

// Mock S3 Upload - simplified (no EventEmitter progress tracking needed)
const mockUploadDone = jest.fn<() => Promise<{Location: string}>>()
const mockCreateS3Upload = jest.fn<(bucket: string, key: string, body: unknown, contentType: string, options?: object) => {done: typeof mockUploadDone}>(
  () => ({done: mockUploadDone})
)

jest.unstable_mockModule('#lib/vendor/AWS/S3', () => ({createS3Upload: mockCreateS3Upload}))

// Mock CloudWatch vendor wrapper
jest.unstable_mockModule('#lib/vendor/AWS/CloudWatch', () => ({putMetricData: jest.fn(), getStandardUnit: (unit?: string) => unit || 'None'}))

// Set up environment variable before importing
process.env.YtdlpBinaryPath = '/opt/bin/yt-dlp_linux'

// Import after mocking
const {downloadVideoToS3, getVideoID, isCookieExpirationError} = await import('./YouTube')

describe('#Vendor:YouTube', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCopyFile.mockResolvedValue(undefined)
    mockStat.mockResolvedValue({size: 52428800}) // 50MB default
    mockUnlink.mockResolvedValue(undefined)
    mockCreateReadStream.mockReturnValue(new Readable({read() {}}))
    mockUploadDone.mockResolvedValue({Location: 's3://test-bucket/test.mp4'})
  })

  describe('downloadVideoToS3', () => {
    test('should download to temp file and stream to S3', async () => {
      const mockYtdlp = createMockProcess()
      mockSpawn.mockReturnValue(mockYtdlp)

      const resultPromise = downloadVideoToS3('https://www.youtube.com/watch?v=test123', 'test-bucket', 'test123.mp4')

      // Simulate successful yt-dlp exit
      await new Promise((resolve) => setTimeout(resolve, 10))
      mockYtdlp.emit('exit', 0)

      const result = await resultPromise

      // Verify yt-dlp was called with file output (NOT -o -)
      expect(mockSpawn).toHaveBeenCalledWith('/opt/bin/yt-dlp_linux',
        expect.arrayContaining(['-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', '--merge-output-format', 'mp4', '-o', '/tmp/test123.mp4']),
        {cwd: '/tmp'})

      // Verify cookies were copied
      expect(mockCopyFile).toHaveBeenCalledWith('/opt/cookies/youtube-cookies.txt', '/tmp/youtube-cookies.txt')

      // Verify temp file was read and uploaded
      expect(mockCreateReadStream).toHaveBeenCalledWith('/tmp/test123.mp4')
      expect(mockCreateS3Upload).toHaveBeenCalledWith('test-bucket', 'test123.mp4', expect.any(Object), 'video/mp4',
        expect.objectContaining({partSize: 10 * 1024 * 1024}))

      // Verify cleanup
      expect(mockUnlink).toHaveBeenCalledWith('/tmp/test123.mp4')

      expect(result).toEqual({fileSize: 52428800, s3Url: 's3://test-bucket/test123.mp4', duration: expect.any(Number)})
    })

    test('should clean up temp file on yt-dlp failure', async () => {
      const mockYtdlp = createMockProcess()
      mockSpawn.mockReturnValue(mockYtdlp)

      const resultPromise = downloadVideoToS3('https://www.youtube.com/watch?v=test123', 'test-bucket', 'test123.mp4')

      await new Promise((resolve) => setTimeout(resolve, 10))
      mockYtdlp.stderr.emit('data', Buffer.from('ERROR: Video unavailable'))
      mockYtdlp.emit('exit', 1)

      await expect(resultPromise).rejects.toThrow('yt-dlp')

      // Verify cleanup attempted
      expect(mockUnlink).toHaveBeenCalledWith('/tmp/test123.mp4')
    })

    test('should detect cookie expiration in stderr', async () => {
      const mockYtdlp = createMockProcess()
      mockSpawn.mockReturnValue(mockYtdlp)

      const resultPromise = downloadVideoToS3('https://www.youtube.com/watch?v=test123', 'test-bucket', 'test123.mp4')

      await new Promise((resolve) => setTimeout(resolve, 10))
      mockYtdlp.stderr.emit('data', Buffer.from("Sign in to confirm you're not a bot"))
      mockYtdlp.emit('exit', 1)

      await expect(resultPromise).rejects.toThrow('cookie')
    })

    test('should clean up temp file on S3 upload failure', async () => {
      const mockYtdlp = createMockProcess()
      mockSpawn.mockReturnValue(mockYtdlp)
      mockUploadDone.mockRejectedValue(new Error('S3 upload failed'))

      const resultPromise = downloadVideoToS3('https://www.youtube.com/watch?v=test123', 'test-bucket', 'test123.mp4')

      await new Promise((resolve) => setTimeout(resolve, 10))
      mockYtdlp.emit('exit', 0)

      await expect(resultPromise).rejects.toThrow('S3')
      expect(mockUnlink).toHaveBeenCalledWith('/tmp/test123.mp4')
    })

    test('should handle yt-dlp process spawn error', async () => {
      const mockYtdlp = createMockProcess()
      mockSpawn.mockReturnValue(mockYtdlp)

      const resultPromise = downloadVideoToS3('https://www.youtube.com/watch?v=test123', 'test-bucket', 'test123.mp4')

      await new Promise((resolve) => setTimeout(resolve, 10))
      mockYtdlp.emit('error', new Error('spawn ENOENT'))

      await expect(resultPromise).rejects.toThrow('spawn ENOENT')
      expect(mockUnlink).toHaveBeenCalledWith('/tmp/test123.mp4')
    })
  })

  describe('isCookieExpirationError', () => {
    test('should detect bot detection message', () => {
      expect(isCookieExpirationError("Sign in to confirm you're not a bot")).toBe(true)
    })

    test('should detect 403 Forbidden', () => {
      expect(isCookieExpirationError('HTTP Error 403: Forbidden')).toBe(true)
    })

    test('should detect cookie-related errors', () => {
      expect(isCookieExpirationError('cookies have expired')).toBe(true)
    })

    test('should not match unrelated errors', () => {
      expect(isCookieExpirationError('Video not available')).toBe(false)
    })
  })

  describe('getVideoID', () => {
    test('should extract video ID from standard watch URL', () => {
      expect(getVideoID('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    test('should extract video ID from short URL', () => {
      expect(getVideoID('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    test('should extract video ID from embed URL', () => {
      expect(getVideoID('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    test('should extract video ID from v/ URL', () => {
      expect(getVideoID('https://www.youtube.com/v/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    test('should throw error for invalid URL', () => {
      expect(() => getVideoID('https://example.com/video')).toThrow('Invalid YouTube URL format')
    })
  })
})
