import YTDlpWrap from 'yt-dlp-wrap'
import {spawn} from 'child_process'
import {PassThrough} from 'stream'
import {Upload} from '@aws-sdk/lib-storage'
import {S3Client, HeadObjectCommand} from '@aws-sdk/client-s3'
import {StandardUnit} from '@aws-sdk/client-cloudwatch'
import {logDebug, logError, putMetrics} from '../../util/lambda-helpers'
import {UnexpectedError, CookieExpirationError} from '../../util/errors'
import {assertIsError} from '../../util/transformers'

const YTDLP_BINARY_PATH = process.env.YTDLP_BINARY_PATH || '/opt/bin/yt-dlp_linux'

/**
 * Check if an error message indicates cookie expiration or bot detection
 * @param errorMessage - Error message from yt-dlp
 * @returns true if error is related to cookie expiration
 */
function isCookieExpirationError(errorMessage: string): boolean {
  const cookieErrorPatterns = [
    'Sign in to confirm you\'re not a bot',
    'Sign in to confirm',
    'bot detection',
    'cookies',
    'This helps protect our community',
    'HTTP Error 403',
    'Forbidden'
  ]

  const lowerMessage = errorMessage.toLowerCase()
  return cookieErrorPatterns.some(pattern => lowerMessage.includes(pattern.toLowerCase()))
}

// yt-dlp video info types
interface YtDlpVideoInfo {
  id: string
  title: string
  formats: YtDlpFormat[]
  thumbnail: string
  duration: number
  description?: string
  uploader?: string
  upload_date?: string
  view_count?: number
  filesize?: number
}

interface YtDlpFormat {
  format_id: string
  url: string
  ext: string
  filesize?: number
  width?: number
  height?: number
  fps?: number
  vcodec?: string
  acodec?: string
  abr?: number
  vbr?: number
  tbr?: number
}

/**
 * Fetch video information using yt-dlp
 * @param uri - YouTube video URL
 * @returns Video information including formats and metadata
 */
export async function fetchVideoInfo(uri: string): Promise<YtDlpVideoInfo> {
  logDebug('fetchVideoInfo =>', {uri, binaryPath: YTDLP_BINARY_PATH})

  try {
    const ytDlp = new YTDlpWrap(YTDLP_BINARY_PATH)

    // Copy cookies from read-only /opt to writable /tmp
    // yt-dlp needs write access to update cookies after use
    const fs = await import('fs')
    const cookiesSource = '/opt/cookies/youtube-cookies.txt'
    const cookiesDest = '/tmp/youtube-cookies.txt'
    await fs.promises.copyFile(cookiesSource, cookiesDest)

    // Configure yt-dlp with flags to work around restrictions
    // - player_client=default: Use alternate extraction method
    // - no-warnings: Suppress format selection warnings
    // - cookies: Use authentication cookies from /tmp (writable)
    // Note: Node.js runtime detection handled via PATH environment variable
    const ytdlpFlags = [
      '--extractor-args', 'youtube:player_client=default',
      '--no-warnings',
      '--cookies', cookiesDest
    ]

    // Get video info in JSON format
    const info = await ytDlp.getVideoInfo([uri, ...ytdlpFlags]) as YtDlpVideoInfo

    logDebug('fetchVideoInfo <=', {
      id: info.id,
      title: info.title,
      formatCount: info.formats?.length || 0
    })

    return info
  } catch (error) {
    assertIsError(error)
    logError('fetchVideoInfo error', error)

    // Check if this is a cookie expiration error
    if (isCookieExpirationError(error.message)) {
      logError('Cookie expiration detected', {message: error.message})
      throw new CookieExpirationError(`YouTube cookie expiration or bot detection: ${error.message}`)
    }

    throw new UnexpectedError(`Failed to fetch video info: ${error.message}`)
  }
}

/**
 * Choose the best video format from available formats
 * Strategy: Prefer progressive (direct download) > HLS > DASH
 * @param info - Video information from yt-dlp
 * @returns Selected video format
 */
export function chooseVideoFormat(info: YtDlpVideoInfo): YtDlpFormat {
  if (!info.formats || info.formats.length === 0) {
    throw new UnexpectedError('No formats available for video')
  }

  // Filter for combined formats (video + audio in one file)
  const combinedFormats = info.formats.filter(f =>
    f.vcodec && f.vcodec !== 'none' &&
    f.acodec && f.acodec !== 'none' &&
    f.url
  )

  if (combinedFormats.length === 0) {
    throw new UnexpectedError('No combined video+audio formats available')
  }

  // 1. Try progressive formats with known filesize (BEST - direct download URL)
  const progressiveWithSize = combinedFormats.filter(f =>
    f.filesize && f.filesize > 0 &&
    !f.url.includes('manifest') &&
    !f.url.includes('.m3u8')
  )

  if (progressiveWithSize.length > 0) {
    const sorted = progressiveWithSize.sort((a, b) => (b.filesize || 0) - (a.filesize || 0))
    logDebug('chooseVideoFormat: progressive with filesize', {
      formatId: sorted[0].format_id,
      filesize: sorted[0].filesize,
      ext: sorted[0].ext
    })
    return sorted[0]
  }

  // 2. Try progressive formats without filesize (GOOD - direct download URL, size unknown)
  const progressiveWithoutSize = combinedFormats.filter(f =>
    !f.url.includes('manifest') &&
    !f.url.includes('.m3u8')
  )

  if (progressiveWithoutSize.length > 0) {
    const sorted = progressiveWithoutSize.sort((a, b) => {
      if (a.tbr && b.tbr) return b.tbr - a.tbr
      return 0
    })
    logDebug('chooseVideoFormat: progressive without filesize', {
      formatId: sorted[0].format_id,
      tbr: sorted[0].tbr,
      ext: sorted[0].ext
    })
    return sorted[0]
  }

  // 3. Accept HLS/DASH streaming formats (ACCEPTABLE - will stream via yt-dlp)
  // This is the modern YouTube default - yt-dlp handles the streaming
  const sorted = combinedFormats.sort((a, b) => {
    // Prefer formats with filesize estimate
    if (a.filesize && !b.filesize) return -1
    if (!a.filesize && b.filesize) return 1
    // Otherwise sort by bitrate (quality)
    if (a.tbr && b.tbr) return b.tbr - a.tbr
    return 0
  })

  logDebug('chooseVideoFormat: streaming format (HLS/DASH)', {
    formatId: sorted[0].format_id,
    filesize: sorted[0].filesize || 'estimated',
    tbr: sorted[0].tbr,
    ext: sorted[0].ext,
    isManifest: sorted[0].url.includes('manifest') || sorted[0].url.includes('.m3u8')
  })

  return sorted[0]
}

/**
 * Extract video ID from YouTube URL
 * @param url - YouTube video URL
 * @returns Video ID
 */
export function getVideoID(url: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }

  throw new UnexpectedError('Invalid YouTube URL format')
}

/**
 * Stream video directly from yt-dlp to S3 using multipart upload
 * @param uri - YouTube video URL
 * @param s3Client - Configured S3 client
 * @param bucket - Target S3 bucket name
 * @param key - Target S3 object key
 * @returns Upload results including file size, S3 URL, and duration
 */
export async function streamVideoToS3(
  uri: string,
  s3Client: S3Client,
  bucket: string,
  key: string
): Promise<{
  fileSize: number
  s3Url: string
  duration: number
}> {
  logDebug('streamVideoToS3 =>', {uri, bucket, key, binaryPath: YTDLP_BINARY_PATH})

  try {
    const startTime = Date.now()

    // Copy cookies from read-only /opt to writable /tmp
    // yt-dlp needs write access to update cookies after use
    const fs = await import('fs')
    const cookiesSource = '/opt/cookies/youtube-cookies.txt'
    const cookiesDest = '/tmp/youtube-cookies.txt'
    await fs.promises.copyFile(cookiesSource, cookiesDest)

    // Configure yt-dlp arguments for streaming to stdout
    const ytdlpArgs = [
      '-o', '-',  // Output to stdout
      '--extractor-args', 'youtube:player_client=default',
      '--no-warnings',
      '--cookies', cookiesDest,
      uri
    ]

    logDebug('Spawning yt-dlp process', {args: ytdlpArgs})

    // Spawn yt-dlp process with /tmp as working directory
    // This is critical for HLS/DASH downloads which need to write fragment files
    const ytdlp = spawn(YTDLP_BINARY_PATH, ytdlpArgs, {cwd: '/tmp'})

    // Create pass-through stream to connect yt-dlp stdout to S3 upload
    const passThrough = new PassThrough()

    // Pipe yt-dlp stdout to pass-through stream
    ytdlp.stdout.pipe(passThrough)

    // Track stderr for error messages
    let stderrOutput = ''
    ytdlp.stderr.on('data', (chunk) => {
      stderrOutput += chunk.toString()
    })

    // Handle passThrough stream errors
    passThrough.on('error', (error) => {
      logError('PassThrough stream error', error)
    })

    // Handle yt-dlp process errors
    ytdlp.on('error', (error) => {
      logError('yt-dlp process error', error)
      passThrough.destroy(error)
    })

    // Handle yt-dlp process exit
    ytdlp.on('exit', (code) => {
      if (code !== 0) {
        logError('yt-dlp stderr output', stderrOutput)
        logError('yt-dlp exited with non-zero code', {code, uri})

        // Check if this is a cookie expiration error
        let error: Error
        if (isCookieExpirationError(stderrOutput)) {
          logError('Cookie expiration detected in stderr', {stderrOutput})
          error = new CookieExpirationError(
            `YouTube cookie expiration or bot detection: ${stderrOutput}`
          )
        } else {
          error = new UnexpectedError(
            `yt-dlp process exited with code ${code}: ${stderrOutput}`
          )
        }

        logError('yt-dlp process exit error', error)
        passThrough.destroy(error)
      }
    })

    // Create S3 upload with streaming support
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: passThrough,
        ContentType: 'video/mp4'
      },
      queueSize: 4,  // Number of concurrent part uploads
      partSize: 5 * 1024 * 1024  // 5MB parts (minimum for S3 multipart)
    })

    // Monitor upload progress
    let bytesUploaded = 0
    upload.on('httpUploadProgress', (progress) => {
      if (progress.loaded) {
        bytesUploaded = progress.loaded
        logDebug('Upload progress', {
          loaded: progress.loaded,
          total: progress.total,
          key
        })
      }
    })

    // Wait for upload to complete
    logDebug('Starting S3 upload', {bucket, key})
    const uploadResult = await upload.done()
    logDebug('S3 upload completed', {location: uploadResult.Location})

    // Get final file size from S3
    const headResult = await s3Client.send(
      new HeadObjectCommand({Bucket: bucket, Key: key})
    )

    const fileSize = headResult.ContentLength || bytesUploaded
    const duration = Math.floor((Date.now() - startTime) / 1000)
    const s3Url = `s3://${bucket}/${key}`

    logDebug('streamVideoToS3 <=', {
      fileSize,
      s3Url,
      duration,
      bytesUploaded
    })

    // Publish CloudWatch metrics
    const throughputMBps = fileSize > 0 && duration > 0
      ? (fileSize / 1024 / 1024) / duration
      : 0

    await putMetrics([
      {name: 'VideoDownloadSuccess', value: 1, unit: StandardUnit.Count},
      {name: 'VideoDownloadDuration', value: duration, unit: StandardUnit.Seconds},
      {name: 'VideoFileSize', value: fileSize, unit: StandardUnit.Bytes},
      {name: 'VideoThroughput', value: throughputMBps, unit: StandardUnit.None}
    ])

    return {
      fileSize,
      s3Url,
      duration
    }
  } catch (error) {
    assertIsError(error)
    logError('streamVideoToS3 error', error)

    // Publish failure metric
    await putMetrics([
      {name: 'VideoDownloadFailure', value: 1, unit: StandardUnit.Count}
    ])

    // Re-throw CookieExpirationError without wrapping it
    if (error instanceof CookieExpirationError) {
      throw error
    }

    // Check if the error message contains cookie expiration indicators
    if (isCookieExpirationError(error.message)) {
      throw new CookieExpirationError(`YouTube cookie expiration or bot detection: ${error.message}`)
    }

    throw new UnexpectedError(`Failed to stream video to S3: ${error.message}`)
  }
}
