import {CookieExpirationError} from './errors'
import type {SchedulingVideoInfo, VideoErrorCategory, VideoErrorClassification} from '#types/video'

/** Patterns indicating permanent failures that should not be retried */
const PERMANENT_ERROR_PATTERNS = [
  'this video is private',
  'this video has been removed',
  'this video is no longer available',
  'the uploader has not made this video available',
  'this video contains content from',
  'who has blocked it',
  'video is unavailable',
  'this video is not available',
  'join this channel to get access',
  'members-only content',
  'this live event will begin',
  'premiere will begin'
]

/** Patterns indicating transient/network errors that should be retried with backoff */
const TRANSIENT_ERROR_PATTERNS = [
  'http error 429',
  'too many requests',
  'connection reset',
  'econnreset',
  'etimedout',
  'network is unreachable',
  'temporary failure',
  'service unavailable',
  'http error 503',
  'http error 502',
  'bad gateway',
  'gateway timeout',
  'http error 504'
]

/** Patterns indicating scheduled content (used as hints alongside release_timestamp) */
const SCHEDULED_CONTENT_PATTERNS = ['premieres in', 'scheduled for', 'upcoming', 'will be available']

/** Default retry buffer in seconds (added to release_timestamp) */
const RETRY_BUFFER_SECONDS = 300 // 5 minutes

/** Default max retries for different categories */
const DEFAULT_MAX_RETRIES: Record<VideoErrorCategory, number> = {
  scheduled: 3, // Scheduled videos should succeed quickly after release
  livestream_upcoming: 10, // Livestreams may have variable start times
  transient: 5, // Standard exponential backoff
  cookie_expired: 0, // Requires manual intervention
  permanent: 0 // Never retry
}

/** Exponential backoff delays in seconds */
const BACKOFF_DELAYS = [
  15 * 60, // 15 minutes
  30 * 60, // 30 minutes
  60 * 60, // 1 hour
  2 * 60 * 60, // 2 hours
  4 * 60 * 60 // 4 hours
]

/**
 * Calculate exponential backoff delay for retries
 * @param retryCount - Number of previous retry attempts (0-indexed)
 * @param baseDelaySeconds - Base delay in seconds (default: 15 minutes)
 * @param maxDelaySeconds - Maximum delay cap in seconds (default: 4 hours)
 * @returns Unix timestamp (seconds) for when to retry
 */
export function calculateExponentialBackoff(retryCount: number, baseDelaySeconds = 15 * 60, maxDelaySeconds = 4 * 60 * 60): number {
  const now = Math.floor(Date.now() / 1000)

  // Use predefined delays if available, otherwise calculate exponentially
  if (retryCount < BACKOFF_DELAYS.length) {
    return now + BACKOFF_DELAYS[retryCount]
  }

  // Exponential backoff: base * 2^retryCount, capped at max
  const delay = Math.min(baseDelaySeconds * Math.pow(2, retryCount), maxDelaySeconds)
  return now + delay
}

/**
 * Check if error message matches any pattern in a list (case-insensitive)
 */
function matchesPattern(message: string, patterns: string[]): boolean {
  const lowerMessage = message.toLowerCase()
  return patterns.some((pattern) => lowerMessage.includes(pattern.toLowerCase()))
}

/**
 * Check if the video has a future release timestamp indicating scheduled content
 */
function isScheduledContent(videoInfo?: SchedulingVideoInfo): boolean {
  if (!videoInfo?.release_timestamp) {
    return false
  }
  const now = Math.floor(Date.now() / 1000)
  return videoInfo.release_timestamp > now
}

/**
 * Check if the video is an upcoming livestream
 */
function isUpcomingLivestream(videoInfo?: SchedulingVideoInfo): boolean {
  if (!videoInfo) {
    return false
  }
  return videoInfo.is_live === false && videoInfo.live_status === 'is_upcoming'
}

/**
 * Classify a video download error to determine retry strategy
 *
 * Classification priority:
 * 1. Cookie expiration (requires manual intervention)
 * 2. Scheduled content (retry at release_timestamp)
 * 3. Upcoming livestream (retry at release or with backoff)
 * 4. Transient errors (exponential backoff)
 * 5. Permanent failures (no retry)
 *
 * @param error - The error that occurred during download
 * @param videoInfo - Optional video info that may contain scheduling metadata
 * @param retryCount - Current retry count (for backoff calculation)
 * @returns Classification with retry strategy
 */
export function classifyVideoError(error: Error, videoInfo?: SchedulingVideoInfo, retryCount = 0): VideoErrorClassification {
  const errorMessage = error.message || ''

  // Priority 1: Cookie expiration (requires manual intervention)
  if (error instanceof CookieExpirationError) {
    return {
      category: 'cookie_expired',
      retryable: false,
      maxRetries: DEFAULT_MAX_RETRIES.cookie_expired,
      reason: 'YouTube cookie expired or bot detection triggered. Manual cookie refresh required.'
    }
  }

  // Priority 2: Upcoming livestream (check before scheduled to handle livestreams with release_timestamp)
  if (isUpcomingLivestream(videoInfo)) {
    const retryAfter = videoInfo?.release_timestamp ? videoInfo.release_timestamp + RETRY_BUFFER_SECONDS : calculateExponentialBackoff(retryCount)

    return {
      category: 'livestream_upcoming',
      retryable: true,
      retryAfter,
      maxRetries: DEFAULT_MAX_RETRIES.livestream_upcoming,
      reason: videoInfo?.release_timestamp
        ? `Livestream scheduled for ${new Date(videoInfo.release_timestamp * 1000).toISOString()}`
        : 'Livestream not yet started, retrying with backoff'
    }
  }

  // Priority 3: Scheduled content with known release time
  if (isScheduledContent(videoInfo)) {
    const releaseTime = videoInfo!.release_timestamp!
    return {
      category: 'scheduled',
      retryable: true,
      retryAfter: releaseTime + RETRY_BUFFER_SECONDS,
      maxRetries: DEFAULT_MAX_RETRIES.scheduled,
      reason: `Video scheduled for release at ${new Date(releaseTime * 1000).toISOString()}`
    }
  }

  // Priority 4: Check error message for scheduled content hints
  // (when videoInfo doesn't have release_timestamp but error suggests scheduling)
  if (matchesPattern(errorMessage, SCHEDULED_CONTENT_PATTERNS)) {
    return {
      category: 'scheduled',
      retryable: true,
      retryAfter: calculateExponentialBackoff(retryCount),
      maxRetries: DEFAULT_MAX_RETRIES.scheduled,
      reason: 'Video appears to be scheduled content based on error message'
    }
  }

  // Priority 5: Transient/network errors
  if (matchesPattern(errorMessage, TRANSIENT_ERROR_PATTERNS)) {
    return {
      category: 'transient',
      retryable: true,
      retryAfter: calculateExponentialBackoff(retryCount),
      maxRetries: DEFAULT_MAX_RETRIES.transient,
      reason: `Transient error detected: ${errorMessage.substring(0, 100)}`
    }
  }

  // Priority 6: Permanent failures
  if (matchesPattern(errorMessage, PERMANENT_ERROR_PATTERNS)) {
    return {
      category: 'permanent',
      retryable: false,
      maxRetries: DEFAULT_MAX_RETRIES.permanent,
      reason: `Permanent failure: ${errorMessage.substring(0, 200)}`
    }
  }

  // Default: Treat unknown errors as transient (give benefit of the doubt)
  // This allows recovery from unexpected temporary issues
  return {
    category: 'transient',
    retryable: true,
    retryAfter: calculateExponentialBackoff(retryCount),
    maxRetries: DEFAULT_MAX_RETRIES.transient,
    reason: `Unknown error, treating as transient: ${errorMessage.substring(0, 100)}`
  }
}

/**
 * Check if a file should be permanently failed based on retry exhaustion
 * @param retryCount - Current retry count
 * @param maxRetries - Maximum allowed retries
 * @returns true if retries are exhausted
 */
export function isRetryExhausted(retryCount: number, maxRetries: number): boolean {
  return retryCount >= maxRetries
}
