import {beforeEach, describe, expect, it, jest} from '@jest/globals'

// Mock the errors module before importing the classifier
jest.unstable_mockModule('./errors', () => ({
  CookieExpirationError: class CookieExpirationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'CookieExpirationError'
    }
  }
}))

const {CookieExpirationError} = await import('./errors')
const {classifyVideoError, calculateExponentialBackoff, isRetryExhausted} = await import('./video-error-classifier')

describe('video-error-classifier', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  describe('classifyVideoError', () => {
    describe('cookie expiration errors', () => {
      it('should classify CookieExpirationError as cookie_expired', () => {
        const error = new CookieExpirationError('Sign in to confirm you are not a bot')

        const result = classifyVideoError(error)

        expect(result.category).toBe('cookie_expired')
        expect(result.retryable).toBe(false)
        expect(result.retryAfter).toBeUndefined()
        expect(result.maxRetries).toBe(0)
      })
    })

    describe('scheduled video errors', () => {
      it('should classify video with future release_timestamp as scheduled', () => {
        const error = new Error('Video unavailable')
        const futureTimestamp = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
        const videoInfo = {release_timestamp: futureTimestamp}

        const result = classifyVideoError(error, videoInfo)

        expect(result.category).toBe('scheduled')
        expect(result.retryable).toBe(true)
        expect(result.retryAfter).toBe(futureTimestamp + 300) // +5 min buffer
        expect(result.maxRetries).toBe(3)
        expect(result.reason).toContain('scheduled for release')
      })

      it('should not classify video with past release_timestamp as scheduled', () => {
        const error = new Error('Video unavailable')
        const pastTimestamp = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
        const videoInfo = {release_timestamp: pastTimestamp}

        const result = classifyVideoError(error, videoInfo)

        expect(result.category).not.toBe('scheduled')
      })

      it('should classify error with scheduled content pattern as scheduled', () => {
        const error = new Error('Premieres in 2 hours')

        const result = classifyVideoError(error)

        expect(result.category).toBe('scheduled')
        expect(result.retryable).toBe(true)
        expect(result.retryAfter).toBeDefined()
      })
    })

    describe('upcoming livestream errors', () => {
      it('should classify upcoming livestream with release_timestamp', () => {
        const error = new Error('Livestream not started')
        const futureTimestamp = Math.floor(Date.now() / 1000) + 7200 // 2 hours from now
        const videoInfo = {is_live: false, live_status: 'is_upcoming' as const, release_timestamp: futureTimestamp}

        const result = classifyVideoError(error, videoInfo)

        expect(result.category).toBe('livestream_upcoming')
        expect(result.retryable).toBe(true)
        expect(result.retryAfter).toBe(futureTimestamp + 300)
        expect(result.maxRetries).toBe(10)
      })

      it('should classify upcoming livestream without release_timestamp using backoff', () => {
        const error = new Error('Livestream not started')
        const videoInfo = {is_live: false, live_status: 'is_upcoming' as const}

        const result = classifyVideoError(error, videoInfo, 0)

        expect(result.category).toBe('livestream_upcoming')
        expect(result.retryable).toBe(true)
        expect(result.retryAfter).toBeDefined()
        expect(result.reason).toContain('retrying with backoff')
      })
    })

    describe('transient errors', () => {
      it.each([
        ['HTTP Error 429: Too Many Requests'],
        ['Connection reset by peer'],
        ['ECONNRESET'],
        ['ETIMEDOUT'],
        ['Network is unreachable'],
        ['HTTP Error 503'],
        ['Bad Gateway'],
        ['Gateway timeout']
      ])('should classify "%s" as transient', (errorMessage) => {
        const error = new Error(errorMessage)

        const result = classifyVideoError(error)

        expect(result.category).toBe('transient')
        expect(result.retryable).toBe(true)
        expect(result.retryAfter).toBeDefined()
        expect(result.maxRetries).toBe(5)
      })
    })

    describe('permanent errors', () => {
      it.each([
        ['This video is private'],
        ['This video has been removed'],
        ['This video is no longer available'],
        ['The uploader has not made this video available'],
        ['Video is unavailable'],
        ['Join this channel to get access'],
        ['Members-only content']
      ])('should classify "%s" as permanent', (errorMessage) => {
        const error = new Error(errorMessage)

        const result = classifyVideoError(error)

        expect(result.category).toBe('permanent')
        expect(result.retryable).toBe(false)
        expect(result.retryAfter).toBeUndefined()
        expect(result.maxRetries).toBe(0)
      })
    })

    describe('unknown errors', () => {
      it('should treat unknown errors as transient (benefit of doubt)', () => {
        const error = new Error('Some unknown error we have never seen')

        const result = classifyVideoError(error)

        expect(result.category).toBe('transient')
        expect(result.retryable).toBe(true)
        expect(result.retryAfter).toBeDefined()
        expect(result.reason).toContain('Unknown error')
      })
    })
  })

  describe('calculateExponentialBackoff', () => {
    it('should return predefined delays for first 5 retries', () => {
      const now = Math.floor(Date.now() / 1000)

      expect(calculateExponentialBackoff(0)).toBe(now + 15 * 60) // 15 min
      expect(calculateExponentialBackoff(1)).toBe(now + 30 * 60) // 30 min
      expect(calculateExponentialBackoff(2)).toBe(now + 60 * 60) // 1 hour
      expect(calculateExponentialBackoff(3)).toBe(now + 2 * 60 * 60) // 2 hours
      expect(calculateExponentialBackoff(4)).toBe(now + 4 * 60 * 60) // 4 hours
    })

    it('should cap delay at maxDelaySeconds for high retry counts', () => {
      const now = Math.floor(Date.now() / 1000)
      const maxDelay = 4 * 60 * 60 // 4 hours default

      // For retry count 10, the exponential would be huge, but should cap
      const result = calculateExponentialBackoff(10)

      expect(result).toBeLessThanOrEqual(now + maxDelay)
    })

    it('should use custom base and max delays', () => {
      const now = Math.floor(Date.now() / 1000)
      const baseDelay = 60 // 1 minute
      const maxDelay = 300 // 5 minutes

      const result = calculateExponentialBackoff(10, baseDelay, maxDelay)

      expect(result).toBe(now + maxDelay)
    })
  })

  describe('isRetryExhausted', () => {
    it('should return false when retryCount < maxRetries', () => {
      expect(isRetryExhausted(0, 5)).toBe(false)
      expect(isRetryExhausted(4, 5)).toBe(false)
    })

    it('should return true when retryCount >= maxRetries', () => {
      expect(isRetryExhausted(5, 5)).toBe(true)
      expect(isRetryExhausted(6, 5)).toBe(true)
    })

    it('should return true when maxRetries is 0', () => {
      expect(isRetryExhausted(0, 0)).toBe(true)
      expect(isRetryExhausted(1, 0)).toBe(true)
    })
  })
})
