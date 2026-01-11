import {spawn} from 'child_process'
import {createReadStream} from 'fs'
import {copyFile, stat, unlink, writeFile} from 'fs/promises'
import type {YtDlpVideoInfo} from '#types/youtube'
import {metrics, MetricUnit} from '#lib/vendor/Powertools'
import {logDebug, logError, logInfo} from '#lib/system/logging'
import {CookieExpirationError, UnexpectedError} from '#lib/system/errors'
import {createS3Upload} from '../vendor/AWS/S3'
import {getOptionalEnv, getRequiredEnv} from '#lib/system/env'
import {getSecretValue} from '#lib/vendor/AWS/SecretsManager'

/**
 * yt-dlp configuration constants
 */
const YTDLP_CONFIG = {
  /** Cookies source path (read-only in Lambda layer - fallback only) */
  COOKIES_SOURCE: '/opt/cookies/youtube-cookies.txt',
  /** Cookies destination path (writable in Lambda) */
  COOKIES_DEST: '/tmp/youtube-cookies.txt',
  /** Output container format */
  MERGE_FORMAT: 'mp4',
  /** Number of concurrent fragment downloads for speed */
  CONCURRENT_FRAGMENTS: '4',
  /** bgutil plugin path in Lambda layer (set via PYTHONPATH env var) */
  PLUGIN_PATH: '/opt/python',
  /** Sleep between requests during data extraction (seconds) - helps avoid rate limiting */
  SLEEP_REQUESTS: process.env.YTDLP_SLEEP_REQUESTS || '1',
  /** Minimum sleep between downloads (seconds) */
  SLEEP_INTERVAL: process.env.YTDLP_SLEEP_INTERVAL || '2',
  /** Maximum sleep between downloads (seconds) - random delay between min and max */
  MAX_SLEEP_INTERVAL: process.env.YTDLP_MAX_SLEEP_INTERVAL || '5'
} as const

/**
 * Prepare cookies for yt-dlp usage.
 * Primary source: AWS Secrets Manager (refreshed by RefreshYouTubeCookies Lambda)
 * Fallback source: Static cookie file in Lambda layer (/opt/cookies/)
 *
 * @returns Path to the writable cookie file
 * @throws Error if neither source is available
 */
async function prepareCookies(): Promise<string> {
  const secretId = getOptionalEnv('YOUTUBE_COOKIES_SECRET_ID', '')

  // Primary path: Secrets Manager (for automated cookie refresh)
  if (secretId) {
    try {
      logDebug('Fetching cookies from Secrets Manager', {secretId})
      const response = await getSecretValue({SecretId: secretId})

      if (response.SecretString) {
        const secret = JSON.parse(response.SecretString) as {cookies: string; extractedAt: string; cookieCount: number}
        logDebug('Cookies retrieved from Secrets Manager', {extractedAt: secret.extractedAt, cookieCount: secret.cookieCount})

        // Write cookies to writable /tmp directory
        await writeFile(YTDLP_CONFIG.COOKIES_DEST, secret.cookies, 'utf-8')
        return YTDLP_CONFIG.COOKIES_DEST
      }
    } catch (error) {
      logInfo('Failed to fetch cookies from Secrets Manager, falling back to layer', {
        secretId,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  // Fallback path: Lambda layer (static cookies from deployment)
  try {
    logDebug('Using fallback cookies from Lambda layer')
    await copyFile(YTDLP_CONFIG.COOKIES_SOURCE, YTDLP_CONFIG.COOKIES_DEST)
    return YTDLP_CONFIG.COOKIES_DEST
  } catch (copyError) {
    logError('Failed to copy cookies from layer', copyError)
    throw copyError instanceof Error ? copyError : new Error(String(copyError))
  }
}

/**
 * Player clients to try in order of preference.
 * mweb is primary (best bot detection bypass with PO tokens).
 * android_vr and ios are fallbacks if mweb fails.
 * @see https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide
 */
const PLAYER_CLIENTS = ['mweb', 'android_vr', 'ios'] as const

/**
 * Format selectors in order of preference (SABR fallback strategy).
 * When YouTube enforces SABR streaming, separate streams (video+audio) return 403.
 * Combined formats bypass SABR restrictions.
 * @see https://github.com/yt-dlp/yt-dlp/issues/12482
 */
const FORMAT_SELECTORS = [
  'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', // Primary: separate streams (best quality)
  'best[ext=mp4]/best', // Fallback 1: combined format (bypasses SABR)
  'bestvideo+bestaudio/best' // Fallback 2: any format
] as const

/**
 * Get extractor args for a specific player client
 */
function getExtractorArgs(client: string): string {
  return `youtube:player_client=${client}`
}

/**
 * Cookie error patterns categorized by severity.
 * - bot_detection: YouTube has detected automated access, requires PO tokens or fresh cookies
 * - cookie_expired: Session cookies have expired, needs cookie refresh
 * - rate_limited: Too many requests, may need to slow down or wait
 */
const COOKIE_ERROR_PATTERNS = {
  bot_detection: [
    "Sign in to confirm you're not a bot",
    'This helps protect our community',
    'bot detection',
    'confirm your human',
    'confirm you are human'
  ],
  cookie_expired: [
    'HTTP Error 403',
    'Forbidden',
    'cookies have expired',
    'session expired',
    'login required'
  ],
  rate_limited: ['HTTP Error 429', 'Too many requests', 'rate limit', 'temporarily blocked']
} as const

/**
 * SABR (Server-side Ad Blocking Response) streaming error patterns.
 * When YouTube enforces SABR, separate video/audio streams fail with 403.
 * Solution: Use combined format selectors instead of separate streams.
 * @see https://github.com/yt-dlp/yt-dlp/issues/12482
 */
const SABR_ERROR_PATTERNS = [
  'SABR streaming',
  'missing a url',
  'formats have been skipped',
  'YouTube is forcing SABR'
] as const

/**
 * Check if an error indicates SABR streaming enforcement
 * @param errorMessage - Error message from yt-dlp
 * @returns true if error is SABR-related
 */
export function isSabrError(errorMessage: string): boolean {
  const lowerMessage = errorMessage.toLowerCase()
  return SABR_ERROR_PATTERNS.some((p) => lowerMessage.includes(p.toLowerCase()))
}

/** Cookie error severity type */
export type CookieErrorSeverity = 'bot_detection' | 'cookie_expired' | 'rate_limited' | null

/**
 * Classify a cookie-related error by severity
 * @param errorMessage - Error message from yt-dlp
 * @returns The error severity category, or null if not a cookie error
 */
export function classifyCookieError(errorMessage: string): CookieErrorSeverity {
  const lowerMessage = errorMessage.toLowerCase()
  for (const [severity, patterns] of Object.entries(COOKIE_ERROR_PATTERNS)) {
    if (patterns.some((p) => lowerMessage.includes(p.toLowerCase()))) {
      return severity as CookieErrorSeverity
    }
  }
  return null
}

/**
 * Check if an error message indicates cookie expiration or bot detection
 * @param errorMessage - Error message from yt-dlp
 * @returns true if error is related to cookie expiration
 */
export function isCookieExpirationError(errorMessage: string): boolean {
  return classifyCookieError(errorMessage) !== null
}

import type {FetchVideoInfoResult} from '#types/video'

/**
 * Execute yt-dlp --dump-json to get video metadata.
 * Direct replacement for yt-dlp-wrap's getVideoInfo method.
 *
 * @param binaryPath - Path to yt-dlp binary
 * @param args - Command line arguments (URL should be last)
 * @returns Parsed video info JSON
 */
function getVideoInfo(binaryPath: string, args: string[]): Promise<YtDlpVideoInfo> {
  return new Promise((resolve, reject) => {
    const proc = spawn(binaryPath, ['--dump-json', ...args])
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    proc.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    proc.on('error', (error) => {
      reject(error)
    })

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout))
        } catch (parseError) {
          reject(new Error(`Failed to parse yt-dlp JSON output: ${parseError}`))
        }
      } else {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`))
      }
    })
  })
}

/**
 * Safely fetch video metadata using yt-dlp with player client rotation.
 *
 * This function is designed to be "safe" - it never throws, instead returning
 * a result object with success/failure status and optional error details.
 * This enables callers to handle errors gracefully (e.g., scheduling retries).
 *
 * Implements player client rotation: tries mweb first, then android_vr, then ios
 * if previous clients fail with non-cookie errors.
 *
 * @param uri - YouTube video URL
 * @returns Result object with video info (if successful) or error details
 */
export async function fetchVideoInfo(uri: string): Promise<FetchVideoInfoResult> {
  const ytdlpBinaryPath = getRequiredEnv('YTDLP_BINARY_PATH')
  logDebug('fetchVideoInfo =>', {uri, binaryPath: ytdlpBinaryPath})

  // Prepare cookies (from Secrets Manager or fallback to layer)
  try {
    await prepareCookies()
  } catch (cookieError) {
    logError('Failed to prepare cookies', cookieError)
    return {success: false, error: cookieError instanceof Error ? cookieError : new Error(String(cookieError)), isCookieError: false}
  }

  // Try each player client in order
  let lastError: Error | undefined
  for (const client of PLAYER_CLIENTS) {
    try {
      logDebug('Trying player client', {client, uri})

      // Configure yt-dlp with flags to work around YouTube restrictions
      const ytdlpFlags = [
        '--extractor-args',
        getExtractorArgs(client),
        '--no-warnings',
        '--cookies',
        YTDLP_CONFIG.COOKIES_DEST,
        '--sleep-requests',
        YTDLP_CONFIG.SLEEP_REQUESTS,
        '--ignore-errors',
        uri
      ]

      // Get video info in JSON format
      const info = await getVideoInfo(ytdlpBinaryPath, ytdlpFlags)

      logDebug('fetchVideoInfo <=', {
        id: info?.id,
        title: info?.title,
        formatCount: info?.formats?.length || 0,
        release_timestamp: info?.release_timestamp,
        live_status: info?.live_status,
        client
      })

      // Track which client succeeded
      metrics.addDimension('PlayerClient', client)
      metrics.addMetric('YouTubeClientSuccess', MetricUnit.Count, 1)

      return {success: true, info}
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      lastError = err
      logDebug('Player client failed', {client, uri, error: err.message})

      // Track client failure
      metrics.addDimension('PlayerClient', client)
      metrics.addMetric('YouTubeClientFailure', MetricUnit.Count, 1)

      // If it's a cookie error, don't try other clients - the issue is auth, not client
      const cookieError = isCookieExpirationError(err.message)
      if (cookieError) {
        logError('Cookie expiration detected', {message: err.message, client})
        const errorSeverity = classifyCookieError(err.message)
        metrics.addDimension('ErrorType', errorSeverity || 'unknown')
        metrics.addMetric('YouTubeAuthFailure', MetricUnit.Count, 1)
        return {success: false, error: err, isCookieError: true}
      }

      // Try next client
      logDebug('Trying next player client', {failedClient: client})
    }
  }

  // All clients failed
  logError('All player clients failed', {uri, lastError: lastError?.message})
  return {success: false, error: lastError || new Error('All player clients failed'), isCookieError: false}
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
 * Download video to temp file then stream to S3 with format fallback.
 *
 * Two-phase approach:
 * 1. yt-dlp downloads to /tmp with proper video+audio merging (uses ffmpeg internally)
 * 2. Stream completed file to S3
 *
 * Implements SABR fallback: tries separate streams first (best quality), then falls
 * back to combined formats if YouTube enforces SABR streaming restrictions.
 *
 * @param uri - YouTube video URL
 * @param bucket - Target S3 bucket name
 * @param key - Target S3 object key (e.g., "dQw4w9WgXcQ.mp4")
 * @returns Upload results including file size, S3 URL, and duration
 */
export async function downloadVideoToS3(uri: string, bucket: string, key: string): Promise<{fileSize: number; s3Url: string; duration: number}> {
  const ytdlpBinaryPath = getRequiredEnv('YTDLP_BINARY_PATH')
  const tempFile = `/tmp/${key}`

  logDebug('downloadVideoToS3 =>', {uri, bucket, key, tempFile})

  const startTime = Date.now()

  try {
    // Prepare cookies (from Secrets Manager or fallback to layer)
    await prepareCookies()

    // Try each format selector in order (SABR fallback strategy)
    let downloadError: Error | undefined
    let usedFormat: string | undefined

    for (const formatSelector of FORMAT_SELECTORS) {
      try {
        logDebug('Trying format selector', {formatSelector})

        // Phase 1: Download to temp file with proper merging (yt-dlp uses ffmpeg internally)
        const ytdlpArgs = [
          '-f',
          formatSelector,
          '--merge-output-format',
          YTDLP_CONFIG.MERGE_FORMAT,
          '--cookies',
          YTDLP_CONFIG.COOKIES_DEST,
          '--extractor-args',
          getExtractorArgs(PLAYER_CLIENTS[0]), // Use primary client for downloads
          '--no-warnings',
          '--concurrent-fragments',
          YTDLP_CONFIG.CONCURRENT_FRAGMENTS,
          '--sleep-interval',
          YTDLP_CONFIG.SLEEP_INTERVAL,
          '--max-sleep-interval',
          YTDLP_CONFIG.MAX_SLEEP_INTERVAL,
          '--progress',
          '--newline',
          '-o',
          tempFile,
          uri
        ]

        logDebug('Phase 1: Downloading to temp file', {args: ytdlpArgs, formatSelector})
        await execYtDlp(ytdlpBinaryPath, ytdlpArgs)
        logDebug('Phase 1 complete: Download finished', {formatSelector})

        // Track which format succeeded
        usedFormat = formatSelector
        metrics.addDimension('FormatSelector', formatSelector === FORMAT_SELECTORS[0] ? 'primary' : 'fallback')
        metrics.addMetric('YouTubeFormatSuccess', MetricUnit.Count, 1)

        break // Success, exit the loop
      } catch (error) {
        downloadError = error instanceof Error ? error : new Error(String(error))
        const errorMessage = downloadError.message

        // Track format failure
        metrics.addDimension('FormatSelector', formatSelector === FORMAT_SELECTORS[0] ? 'primary' : 'fallback')
        metrics.addMetric('YouTubeFormatFailure', MetricUnit.Count, 1)

        // If it's a SABR error or 403 on download, try next format
        if (isSabrError(errorMessage) || (errorMessage.includes('403') && !isCookieExpirationError(errorMessage))) {
          logDebug('Format failed with SABR/403, trying next format', {formatSelector, error: errorMessage})
          // Clean up partial temp file before retry
          try {
            await unlink(tempFile)
          } catch {
            // File may not exist
          }
          continue
        }

        // For other errors (cookie, auth, etc.), don't try other formats
        throw error
      }
    }

    // If all formats failed, throw the last error
    if (!usedFormat) {
      throw downloadError || new Error('All format selectors failed')
    }

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

    // Publish CloudWatch metrics (flushed by Powertools middleware in calling Lambda)
    const throughputMBps = fileSize > 0 && duration > 0 ? fileSize / 1024 / 1024 / duration : 0

    metrics.addMetric('VideoDownloadSuccess', MetricUnit.Count, 1)
    metrics.addMetric('VideoDownloadDuration', MetricUnit.Seconds, duration)
    metrics.addMetric('VideoDownloadSize', MetricUnit.Bytes, fileSize)
    metrics.addMetric('VideoThroughput', MetricUnit.Count, throughputMBps)

    return {fileSize, s3Url, duration}
  } catch (error) {
    logError('downloadVideoToS3 error', error)

    // Always try to clean up temp file
    try {
      await unlink(tempFile)
    } catch {
      // File may not exist if download failed early
    }

    // Publish failure metric (flushed by Powertools middleware in calling Lambda)
    metrics.addMetric('VideoDownloadFailure', MetricUnit.Count, 1)

    // Re-throw CookieExpirationError without wrapping
    if (error instanceof CookieExpirationError) {
      // Track auth failure with error type for CloudWatch alarm
      const errorSeverity = classifyCookieError(error.message)
      metrics.addDimension('ErrorType', errorSeverity || 'unknown')
      metrics.addMetric('YouTubeAuthFailure', MetricUnit.Count, 1)
      throw error
    }

    // Check if error message contains cookie expiration indicators
    const message = error instanceof Error ? error.message : String(error)
    if (isCookieExpirationError(message)) {
      // Track auth failure with error type for CloudWatch alarm
      const errorSeverity = classifyCookieError(message)
      metrics.addDimension('ErrorType', errorSeverity || 'unknown')
      metrics.addMetric('YouTubeAuthFailure', MetricUnit.Count, 1)
      throw new CookieExpirationError(`YouTube cookie expiration or bot detection: ${message}`)
    }

    throw new UnexpectedError(`Failed to download video to S3: ${message}`)
  }
}
