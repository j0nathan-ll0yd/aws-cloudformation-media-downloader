import YTDlpWrap from 'yt-dlp-wrap'
import {spawn} from 'child_process'
import {createReadStream} from 'fs'
import {copyFile, stat, unlink} from 'fs/promises'
import type {YtDlpVideoInfo} from '#types/youtube'
import {putMetrics} from '#util/lambda-helpers'
import {logDebug, logError} from '#util/logging'
import {CookieExpirationError, UnexpectedError} from '#util/errors'
import {createS3Upload} from '../vendor/AWS/S3'
import {getRequiredEnv} from '#util/env-validation'

/**
 * yt-dlp configuration constants
 */
const YTDLP_CONFIG = {
  /** Cookies source path (read-only in Lambda) */
  COOKIES_SOURCE: '/opt/cookies/youtube-cookies.txt',
  /** Cookies destination path (writable in Lambda) */
  COOKIES_DEST: '/tmp/youtube-cookies.txt',
  /** Common extractor args to work around YouTube restrictions */
  EXTRACTOR_ARGS: 'youtube:player_client=default',
  /** Format selection: best mp4 video + m4a audio, fallback to best mp4 or best available */
  FORMAT_SELECTOR: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
  /** Output container format */
  MERGE_FORMAT: 'mp4',
  /** Number of concurrent fragment downloads for speed */
  CONCURRENT_FRAGMENTS: '4'
} as const

/**
 * Check if an error message indicates cookie expiration or bot detection
 * @param errorMessage - Error message from yt-dlp
 * @returns true if error is related to cookie expiration
 */
export function isCookieExpirationError(errorMessage: string): boolean {
  const cookieErrorPatterns = [
    "Sign in to confirm you're not a bot",
    'Sign in to confirm',
    'bot detection',
    'cookies',
    'This helps protect our community',
    'HTTP Error 403',
    'Forbidden'
  ]

  const lowerMessage = errorMessage.toLowerCase()
  return cookieErrorPatterns.some((pattern) => lowerMessage.includes(pattern.toLowerCase()))
}

import type {FetchVideoInfoResult} from '#types/video'

/**
 * Safely fetch video metadata using yt-dlp.
 *
 * This function is designed to be "safe" - it never throws, instead returning
 * a result object with success/failure status and optional error details.
 * This enables callers to handle errors gracefully (e.g., scheduling retries).
 *
 * @param uri - YouTube video URL
 * @returns Result object with video info (if successful) or error details
 */
export async function fetchVideoInfo(uri: string): Promise<FetchVideoInfoResult> {
  const ytdlpBinaryPath = getRequiredEnv('YtdlpBinaryPath')
  logDebug('fetchVideoInfo =>', {uri, binaryPath: ytdlpBinaryPath})

  try {
    const ytDlp = new YTDlpWrap(ytdlpBinaryPath)

    // Copy cookies from read-only /opt to writable /tmp (yt-dlp needs write access)
    const fs = await import('fs')
    await fs.promises.copyFile(YTDLP_CONFIG.COOKIES_SOURCE, YTDLP_CONFIG.COOKIES_DEST)

    // Configure yt-dlp with flags to work around YouTube restrictions
    const ytdlpFlags = [
      '--extractor-args',
      YTDLP_CONFIG.EXTRACTOR_ARGS,
      '--no-warnings',
      '--cookies',
      YTDLP_CONFIG.COOKIES_DEST,
      '--ignore-errors'
    ]

    // Get video info in JSON format
    const info = (await ytDlp.getVideoInfo([uri, ...ytdlpFlags])) as YtDlpVideoInfo

    logDebug('fetchVideoInfo <=', {
      id: info?.id,
      title: info?.title,
      formatCount: info?.formats?.length || 0,
      release_timestamp: info?.release_timestamp,
      live_status: info?.live_status
    })

    return {success: true, info}
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logDebug('fetchVideoInfo error', {uri, error: err.message})

    const cookieError = isCookieExpirationError(err.message)
    if (cookieError) {
      logError('Cookie expiration detected', {message: err.message})
    }

    return {success: false, error: err, isCookieError: cookieError}
  }
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
 * Parse yt-dlp progress line and extract useful info.
 * Progress lines look like: "[download]  45.2% of ~151.23MiB at 2.50MiB/s ETA 00:35"
 */
function parseProgressLine(line: string): {percent?: number; size?: string; speed?: string; eta?: string} | null {
  // Match download progress line
  const progressMatch = line.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+~?(\S+)\s+at\s+(\S+)\s+ETA\s+(\S+)/)
  if (progressMatch) {
    return {percent: parseFloat(progressMatch[1]), size: progressMatch[2], speed: progressMatch[3], eta: progressMatch[4]}
  }

  // Match merger line
  if (line.includes('[Merger]') || line.includes('[ffmpeg]')) {
    return {percent: 100} // Merging means download is complete
  }

  return null
}

/**
 * Execute yt-dlp command and wait for completion.
 * Logs progress periodically during download.
 * @param ytdlpBinaryPath - Path to yt-dlp binary
 * @param args - Command line arguments
 * @returns Promise that resolves on success, rejects with error details on failure
 */
function execYtDlp(ytdlpBinaryPath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn(ytdlpBinaryPath, args, {cwd: '/tmp'})

    let stderr = ''
    let lastLoggedPercent = -10 // Log every 10% progress
    let lastLogTime = Date.now()
    const LOG_INTERVAL_MS = 30000 // Also log at least every 30 seconds

    ytdlp.stderr.on('data', (chunk) => {
      const data = chunk.toString()
      stderr += data

      // Parse and log progress
      const lines = data.split('\n')
      for (const line of lines) {
        const progress = parseProgressLine(line)
        if (progress) {
          const now = Date.now()
          const timeSinceLastLog = now - lastLogTime

          // Log if: 10% progress milestone, 30s elapsed, or merging started
          const shouldLog = (progress.percent !== undefined && progress.percent >= lastLoggedPercent + 10) ||
            timeSinceLastLog >= LOG_INTERVAL_MS ||
            (progress.percent === 100)

          if (shouldLog && progress.percent !== undefined) {
            logDebug('yt-dlp progress', {percent: `${progress.percent.toFixed(1)}%`, size: progress.size, speed: progress.speed, eta: progress.eta})
            lastLoggedPercent = Math.floor(progress.percent / 10) * 10
            lastLogTime = now
          }
        }
      }
    })

    // Also capture stdout for any output (yt-dlp mostly uses stderr)
    ytdlp.stdout.on('data', (chunk) => {
      logDebug('yt-dlp stdout', chunk.toString().trim())
    })

    ytdlp.on('error', (error) => {
      reject(error)
    })

    ytdlp.on('exit', (code) => {
      if (code !== 0) {
        logError('yt-dlp stderr output', stderr)

        if (isCookieExpirationError(stderr)) {
          reject(new CookieExpirationError(`YouTube cookie expiration or bot detection: ${stderr}`))
        } else {
          reject(new UnexpectedError(`yt-dlp exited with code ${code}: ${stderr}`))
        }
      } else {
        resolve()
      }
    })
  })
}

/**
 * Download video to temp file then stream to S3.
 *
 * Two-phase approach:
 * 1. yt-dlp downloads to /tmp with proper video+audio merging (uses ffmpeg internally)
 * 2. Stream completed file to S3
 *
 * This solves the stdout merge bug where yt-dlp concatenates instead of muxing streams.
 *
 * @param uri - YouTube video URL
 * @param bucket - Target S3 bucket name
 * @param key - Target S3 object key (e.g., "dQw4w9WgXcQ.mp4")
 * @returns Upload results including file size, S3 URL, and duration
 */
export async function downloadVideoToS3(uri: string, bucket: string, key: string): Promise<{fileSize: number; s3Url: string; duration: number}> {
  const ytdlpBinaryPath = getRequiredEnv('YtdlpBinaryPath')
  const tempFile = `/tmp/${key}`

  logDebug('downloadVideoToS3 =>', {uri, bucket, key, tempFile})

  const startTime = Date.now()

  try {
    // Copy cookies from read-only /opt to writable /tmp
    await copyFile(YTDLP_CONFIG.COOKIES_SOURCE, YTDLP_CONFIG.COOKIES_DEST)

    // Phase 1: Download to temp file with proper merging (yt-dlp uses ffmpeg internally)
    const ytdlpArgs = [
      '-f',
      YTDLP_CONFIG.FORMAT_SELECTOR,
      '--merge-output-format',
      YTDLP_CONFIG.MERGE_FORMAT,
      '--cookies',
      YTDLP_CONFIG.COOKIES_DEST,
      '--extractor-args',
      YTDLP_CONFIG.EXTRACTOR_ARGS,
      '--no-warnings',
      '--concurrent-fragments',
      YTDLP_CONFIG.CONCURRENT_FRAGMENTS,
      '--progress',
      '--newline',
      '-o',
      tempFile,
      uri
    ]

    logDebug('Phase 1: Downloading to temp file', {args: ytdlpArgs})
    await execYtDlp(ytdlpBinaryPath, ytdlpArgs)
    logDebug('Phase 1 complete: Download finished')

    // Phase 2: Stream file to S3
    logDebug('Phase 2: Streaming to S3', {bucket, key})
    const fileStream = createReadStream(tempFile)
    const upload = createS3Upload(bucket, key, fileStream, 'video/mp4', {
      queueSize: 4,
      partSize: 10 * 1024 * 1024 // 10MB parts for larger files
    })

    await upload.done()
    logDebug('Phase 2 complete: S3 upload finished')

    // Get file size before cleanup
    const stats = await stat(tempFile)
    const fileSize = stats.size

    // Cleanup temp file
    await unlink(tempFile)
    logDebug('Cleanup complete: Temp file deleted')

    const duration = Math.floor((Date.now() - startTime) / 1000)
    const s3Url = `s3://${bucket}/${key}`

    logDebug('downloadVideoToS3 <=', {fileSize, s3Url, duration})

    // Publish CloudWatch metrics
    const throughputMBps = fileSize > 0 && duration > 0 ? fileSize / 1024 / 1024 / duration : 0

    await putMetrics([
      {name: 'VideoDownloadSuccess', value: 1, unit: 'Count'},
      {name: 'VideoDownloadDuration', value: duration, unit: 'Seconds'},
      {name: 'VideoFileSize', value: fileSize, unit: 'Bytes'},
      {name: 'VideoThroughput', value: throughputMBps, unit: 'None'}
    ])

    return {fileSize, s3Url, duration}
  } catch (error) {
    logError('downloadVideoToS3 error', error)

    // Always try to clean up temp file
    try {
      await unlink(tempFile)
    } catch {
      // File may not exist if download failed early
    }

    // Publish failure metric
    await putMetrics([{name: 'VideoDownloadFailure', value: 1, unit: 'Count'}])

    // Re-throw CookieExpirationError without wrapping
    if (error instanceof CookieExpirationError) {
      throw error
    }

    // Check if error message contains cookie expiration indicators
    const message = error instanceof Error ? error.message : String(error)
    if (isCookieExpirationError(message)) {
      throw new CookieExpirationError(`YouTube cookie expiration or bot detection: ${message}`)
    }

    throw new UnexpectedError(`Failed to download video to S3: ${message}`)
  }
}
