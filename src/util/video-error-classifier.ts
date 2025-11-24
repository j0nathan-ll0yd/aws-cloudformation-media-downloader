import {YtDlpVideoInfo} from '../types/youtube'

/**
 * Classification of video download errors
 */
export interface VideoErrorClassification {
  /**
   * Error category
   */
  category: 'scheduled' | 'livestream_upcoming' | 'transient' | 'permanent'
  /**
   * Whether the download can be retried
   */
  retryable: boolean
  /**
   * Unix timestamp (seconds) when retry should be attempted
   */
  retryAfter?: number
  /**
   * Human-readable error reason
   */
  reason: string
}

/**
 * Check if error is a network/transient error
 * @param error - Error object
 * @returns true if error is transient
 */
function isNetworkError(error: Error): boolean {
  const networkErrorPatterns = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'Network', 'timeout', 'connection', 'ECONNREFUSED', 'socket hang up']

  const errorMessage = error.message.toLowerCase()
  return networkErrorPatterns.some((pattern) => errorMessage.includes(pattern.toLowerCase()))
}

/**
 * Calculate exponential backoff delay
 * @param retryCount - Current retry attempt number (0-indexed)
 * @returns Unix timestamp (seconds) for next retry
 */
export function calculateExponentialBackoff(retryCount: number): number {
  const baseDelaySeconds = 300
  const maxDelaySeconds = 3600
  const delaySeconds = Math.min(baseDelaySeconds * Math.pow(2, retryCount), maxDelaySeconds)
  return Math.floor(Date.now() / 1000) + delaySeconds
}

/**
 * Classify video download errors to determine retry strategy
 * @param error - Error that occurred during download
 * @param videoInfo - Optional video metadata from yt-dlp
 * @returns Error classification with retry strategy
 */
export function classifyVideoError(error: Error, videoInfo?: Partial<YtDlpVideoInfo>): VideoErrorClassification {
  const now = Math.floor(Date.now() / 1000)

  if (videoInfo?.release_timestamp && videoInfo.release_timestamp > now) {
    return {
      category: 'scheduled',
      retryable: true,
      retryAfter: videoInfo.release_timestamp + 300,
      reason: `Scheduled for ${new Date(videoInfo.release_timestamp * 1000).toISOString()}`
    }
  }

  if (videoInfo?.is_live === false && videoInfo?.live_status === 'upcoming') {
    return {
      category: 'livestream_upcoming',
      retryable: true,
      retryAfter: videoInfo.release_timestamp || calculateExponentialBackoff(0),
      reason: 'Livestream not yet started'
    }
  }

  if (isNetworkError(error)) {
    return {
      category: 'transient',
      retryable: true,
      retryAfter: calculateExponentialBackoff(0),
      reason: 'Transient network error'
    }
  }

  return {
    category: 'permanent',
    retryable: false,
    reason: error.message
  }
}
