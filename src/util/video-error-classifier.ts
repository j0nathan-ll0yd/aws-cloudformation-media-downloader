import {YtDlpVideoInfo} from '../types/youtube'

export interface VideoErrorClassification {
  category: 'scheduled' | 'permanent' | 'transient' | 'cookie_expired'
  retryable: boolean
  retryAfter?: number
  reason: string
}

/**
 * Classifies video availability errors to determine retry strategy
 * @param error - Error thrown by yt-dlp
 * @param videoInfo - Partial video metadata (if available)
 * @returns Classification with retry strategy
 * @notExported
 */
export function classifyVideoError(error: Error, videoInfo?: Partial<YtDlpVideoInfo>): VideoErrorClassification {
  const errorMessage = error.message.toLowerCase()

  if (videoInfo?.release_timestamp && videoInfo.release_timestamp > Date.now() / 1000) {
    return {
      category: 'scheduled',
      retryable: true,
      retryAfter: videoInfo.release_timestamp + 300,
      reason: `Video scheduled for ${new Date(videoInfo.release_timestamp * 1000).toISOString()}`
    }
  }

  if (errorMessage.includes('sign in to confirm') || errorMessage.includes('not a bot')) {
    return {
      category: 'cookie_expired',
      retryable: false,
      reason: 'YouTube cookie authentication required'
    }
  }

  if (errorMessage.includes('not available in your country') || errorMessage.includes('not made this video available')) {
    return {
      category: 'permanent',
      retryable: false,
      reason: 'Video geo-blocked in current region'
    }
  }

  if (videoInfo?.availability === 'private') {
    return {
      category: 'permanent',
      retryable: false,
      reason: 'Video is private'
    }
  }

  if (errorMessage.includes('video is unavailable') && !videoInfo) {
    return {
      category: 'permanent',
      retryable: false,
      reason: 'Video unavailable (likely deleted or never existed)'
    }
  }

  if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
    return {
      category: 'transient',
      retryable: true,
      retryAfter: Date.now() / 1000 + 3600,
      reason: 'Transient network error'
    }
  }

  return {
    category: 'permanent',
    retryable: false,
    reason: error.message
  }
}

/**
 * Calculates exponential backoff retry time
 * @param retryCount - Current retry attempt (0-based)
 * @param baseDelaySeconds - Base delay (default: 1 hour)
 * @param maxDelaySeconds - Max delay cap (default: 24 hours)
 * @returns Unix timestamp when to retry
 * @notExported
 */
export function calculateExponentialBackoff(retryCount: number, baseDelaySeconds = 3600, maxDelaySeconds = 86400): number {
  const delay = Math.min(baseDelaySeconds * Math.pow(2, retryCount), maxDelaySeconds)
  return Math.floor(Date.now() / 1000 + delay)
}
