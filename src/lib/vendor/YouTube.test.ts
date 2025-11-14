import {describe, expect, test, jest, beforeEach} from '@jest/globals'
import {EventEmitter} from 'events'
import {Readable} from 'stream'

// Mock child_process
const mockSpawn = jest.fn()
jest.unstable_mockModule('child_process', () => ({
  spawn: mockSpawn
}))

// Mock fs
const mockCopyFile = jest.fn<() => Promise<void>>()
jest.unstable_mockModule('fs', () => ({
  promises: {
    copyFile: mockCopyFile
  }
}))

// Mock AWS SDK
let mockUploadInstance: any
let uploadDoneResolver: any
class MockUpload extends EventEmitter {
  public done: any
  constructor(public config: any) {
    super()
    mockUploadInstance = this
    // Create a promise that can be resolved externally
    this.done = jest.fn(() => new Promise((resolve, reject) => {
      uploadDoneResolver = {resolve, reject}
    }))
  }
}

jest.unstable_mockModule('@aws-sdk/lib-storage', () => ({
  Upload: MockUpload
}))

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  HeadObjectCommand: jest.fn()
}))

// Mock logger
jest.unstable_mockModule('../../util/lambda-helpers', () => ({
  logDebug: jest.fn(),
  logError: jest.fn()
}))

// Import after mocking
const {streamVideoToS3, chooseVideoFormat, getVideoID} = await import('./YouTube')

describe('#Vendor:YouTube', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCopyFile.mockResolvedValue(undefined)
    mockUploadInstance = null
    uploadDoneResolver = null
  })

  describe('streamVideoToS3', () => {
    test('should successfully stream video to S3', async () => {
      // Mock yt-dlp process
      const mockProcess = new EventEmitter() as any
      mockProcess.stdout = new Readable({
        read() {
          this.push('video data chunk 1')
          this.push('video data chunk 2')
          this.push(null) // End stream
        }
      })
      mockProcess.stderr = new EventEmitter()
      mockSpawn.mockReturnValue(mockProcess)

      // Mock S3 client
      const mockS3Client = {
        send: jest.fn<() => Promise<{ContentLength: number}>>().mockResolvedValue({
          ContentLength: 1024000
        })
      } as any

      // Start the function (it will create the Upload instance)
      const resultPromise = streamVideoToS3(
        'https://www.youtube.com/watch?v=test123',
        mockS3Client,
        'test-bucket',
        'test-key.mp4'
      )

      // Wait for Upload instance to be created
      await new Promise(resolve => setTimeout(resolve, 10))

      // Simulate successful upload
      mockUploadInstance.emit('httpUploadProgress', {
        loaded: 512000,
        total: 1024000
      })
      mockProcess.emit('exit', 0)

      // Resolve the upload
      uploadDoneResolver.resolve({
        Location: 's3://test-bucket/test-key.mp4'
      })

      const result = await resultPromise

      expect(result).toEqual({
        fileSize: 1024000,
        s3Url: 's3://test-bucket/test-key.mp4',
        duration: expect.any(Number)
      })

      // Verify yt-dlp was spawned correctly
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('yt-dlp'),
        expect.arrayContaining([
          '-o', '-',
          '--extractor-args', 'youtube:player_client=default',
          '--no-warnings',
          '--cookies', '/tmp/youtube-cookies.txt',
          'https://www.youtube.com/watch?v=test123'
        ])
      )

      // Verify cookies were copied
      expect(mockCopyFile).toHaveBeenCalledWith(
        '/opt/cookies/youtube-cookies.txt',
        '/tmp/youtube-cookies.txt'
      )
    })

    test('should handle yt-dlp process error', async () => {
      const mockProcess = new EventEmitter() as any
      const mockStdout = new Readable({read() {}})
      mockStdout.on('error', () => {}) // Suppress error for test
      mockProcess.stdout = mockStdout
      mockProcess.stderr = new EventEmitter()
      mockSpawn.mockReturnValue(mockProcess)

      const mockS3Client = {} as any

      // Start the function
      const resultPromise = streamVideoToS3(
        'https://www.youtube.com/watch?v=test123',
        mockS3Client,
        'test-bucket',
        'test-key.mp4'
      )

      // Wait briefly then simulate process error
      await new Promise(resolve => setTimeout(resolve, 10))
      mockProcess.emit('error', new Error('yt-dlp not found'))

      // Reject the upload promise to propagate the error
      if (uploadDoneResolver) {
        uploadDoneResolver.reject(new Error('yt-dlp not found'))
      }

      await expect(resultPromise).rejects.toThrow('Failed to stream video to S3')
    })

    test('should handle yt-dlp exit with non-zero code', async () => {
      const mockProcess = new EventEmitter() as any
      const mockStdout = new Readable({read() {}})
      mockStdout.on('error', () => {}) // Suppress error for test
      mockProcess.stdout = mockStdout
      mockProcess.stderr = new EventEmitter()
      mockSpawn.mockReturnValue(mockProcess)

      const mockS3Client = {} as any

      // Start the function
      const resultPromise = streamVideoToS3(
        'https://www.youtube.com/watch?v=test123',
        mockS3Client,
        'test-bucket',
        'test-key.mp4'
      )

      // Wait briefly, then simulate stderr output and non-zero exit
      await new Promise(resolve => setTimeout(resolve, 10))
      mockProcess.stderr.emit('data', Buffer.from('ERROR: Video not available'))
      mockProcess.emit('exit', 1)

      // Reject the upload promise
      if (uploadDoneResolver) {
        uploadDoneResolver.reject(new Error('yt-dlp process exited with code 1'))
      }

      await expect(resultPromise).rejects.toThrow('Failed to stream video to S3')
    })

    test('should handle S3 upload failure', async () => {
      const mockProcess = new EventEmitter() as any
      mockProcess.stdout = new Readable({
        read() {
          this.push('video data')
          this.push(null)
        }
      })
      mockProcess.stderr = new EventEmitter()
      mockSpawn.mockReturnValue(mockProcess)

      const mockS3Client = {} as any

      // Start the function
      const resultPromise = streamVideoToS3(
        'https://www.youtube.com/watch?v=test123',
        mockS3Client,
        'test-bucket',
        'test-key.mp4'
      )

      // Wait for Upload instance to be created
      await new Promise(resolve => setTimeout(resolve, 10))

      mockProcess.emit('exit', 0)

      // Reject the upload promise
      uploadDoneResolver.reject(new Error('S3 upload failed'))

      await expect(resultPromise).rejects.toThrow('Failed to stream video to S3')
    })

    test('should track upload progress', async () => {
      const mockProcess = new EventEmitter() as any
      mockProcess.stdout = new Readable({
        read() {
          this.push('video data')
          this.push(null)
        }
      })
      mockProcess.stderr = new EventEmitter()
      mockSpawn.mockReturnValue(mockProcess)

      const mockS3Client = {
        send: jest.fn<() => Promise<{ContentLength: number}>>().mockResolvedValue({
          ContentLength: 2048000
        })
      } as any

      // Start the function
      const resultPromise = streamVideoToS3(
        'https://www.youtube.com/watch?v=test123',
        mockS3Client,
        'test-bucket',
        'test-key.mp4'
      )

      // Wait for Upload instance to be created
      await new Promise(resolve => setTimeout(resolve, 10))

      // Simulate progress updates
      mockUploadInstance.emit('httpUploadProgress', {
        loaded: 512000,
        total: 2048000
      })
      mockUploadInstance.emit('httpUploadProgress', {
        loaded: 1024000,
        total: 2048000
      })
      mockUploadInstance.emit('httpUploadProgress', {
        loaded: 2048000,
        total: 2048000
      })
      mockProcess.emit('exit', 0)

      // Resolve the upload
      uploadDoneResolver.resolve({
        Location: 's3://test-bucket/test-key.mp4'
      })

      const result = await resultPromise

      expect(result.fileSize).toBe(2048000)
    })
  })

  describe('chooseVideoFormat', () => {
    test('should prefer progressive format with filesize', () => {
      const info = {
        id: 'test123',
        title: 'Test Video',
        formats: [
          {
            format_id: 'hls-720',
            url: 'https://manifest.googlevideo.com/api/manifest.m3u8',
            ext: 'mp4',
            vcodec: 'h264',
            acodec: 'aac',
            tbr: 2000
          },
          {
            format_id: '22',
            url: 'https://rr1---sn-ab5l6nez.googlevideo.com/videoplayback',
            ext: 'mp4',
            filesize: 52428800,
            vcodec: 'h264',
            acodec: 'aac',
            tbr: 1500
          }
        ],
        thumbnail: '',
        duration: 300
      }

      const format = chooseVideoFormat(info)
      expect(format.format_id).toBe('22')
      expect(format.filesize).toBe(52428800)
    })

    test('should fall back to progressive without filesize', () => {
      const info = {
        id: 'test123',
        title: 'Test Video',
        formats: [
          {
            format_id: 'hls-720',
            url: 'https://manifest.googlevideo.com/api/manifest.m3u8',
            ext: 'mp4',
            vcodec: 'h264',
            acodec: 'aac',
            tbr: 2000
          },
          {
            format_id: '18',
            url: 'https://rr1---sn-ab5l6nez.googlevideo.com/videoplayback',
            ext: 'mp4',
            vcodec: 'h264',
            acodec: 'aac',
            tbr: 800
          }
        ],
        thumbnail: '',
        duration: 300
      }

      const format = chooseVideoFormat(info)
      expect(format.format_id).toBe('18')
    })

    test('should accept HLS/DASH streaming formats as last resort', () => {
      const info = {
        id: 'test123',
        title: 'Test Video',
        formats: [
          {
            format_id: 'hls-1080',
            url: 'https://manifest.googlevideo.com/api/manifest.m3u8',
            ext: 'mp4',
            filesize: 104857600,
            vcodec: 'h264',
            acodec: 'aac',
            tbr: 3000
          },
          {
            format_id: 'hls-720',
            url: 'https://manifest.googlevideo.com/api/manifest.m3u8',
            ext: 'mp4',
            vcodec: 'h264',
            acodec: 'aac',
            tbr: 2000
          }
        ],
        thumbnail: '',
        duration: 300
      }

      const format = chooseVideoFormat(info)
      expect(format.format_id).toBe('hls-1080')
      expect(format.tbr).toBe(3000)
    })

    test('should throw error if no formats available', () => {
      const info = {
        id: 'test123',
        title: 'Test Video',
        formats: [],
        thumbnail: '',
        duration: 300
      }

      expect(() => chooseVideoFormat(info)).toThrow('No formats available for video')
    })

    test('should throw error if no combined formats available', () => {
      const info = {
        id: 'test123',
        title: 'Test Video',
        formats: [
          {
            format_id: 'video-only',
            url: 'https://example.com/video',
            ext: 'mp4',
            vcodec: 'h264',
            acodec: 'none'
          },
          {
            format_id: 'audio-only',
            url: 'https://example.com/audio',
            ext: 'm4a',
            vcodec: 'none',
            acodec: 'aac'
          }
        ],
        thumbnail: '',
        duration: 300
      }

      expect(() => chooseVideoFormat(info)).toThrow('No combined video+audio formats available')
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
