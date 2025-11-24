import {describe, expect, it, jest, beforeEach} from '@jest/globals'
import {classifyVideoError, calculateExponentialBackoff} from './video-error-classifier'
import {YtDlpVideoInfo} from '../types/youtube'

describe('video-error-classifier', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('calculateExponentialBackoff', () => {
    it('should calculate exponential backoff with base delay of 5 minutes', () => {
      const now = Date.now() / 1000
      const result = calculateExponentialBackoff(0)
      expect(result).toBeGreaterThanOrEqual(now + 300)
      expect(result).toBeLessThanOrEqual(now + 305)
    })

    it('should double delay with each retry', () => {
      const result1 = calculateExponentialBackoff(0)
      const result2 = calculateExponentialBackoff(1)
      const result3 = calculateExponentialBackoff(2)

      const now = Date.now() / 1000
      expect(result2 - now).toBeGreaterThanOrEqual(600)
      expect(result3 - now).toBeGreaterThanOrEqual(1200)
    })

    it('should cap delay at 1 hour', () => {
      const now = Date.now() / 1000
      const result = calculateExponentialBackoff(10)
      expect(result - now).toBeLessThanOrEqual(3600)
    })
  })

  describe('classifyVideoError', () => {
    describe('scheduled videos', () => {
      it('should detect scheduled video with release_timestamp in future', () => {
        const futureTimestamp = Math.floor(Date.now() / 1000) + 86400
        const videoInfo: Partial<YtDlpVideoInfo> = {
          id: 'test123',
          release_timestamp: futureTimestamp
        }
        const error = new Error('Video unavailable')

        const result = classifyVideoError(error, videoInfo)

        expect(result.category).toBe('scheduled')
        expect(result.retryable).toBe(true)
        expect(result.retryAfter).toBe(futureTimestamp + 300)
        expect(result.reason).toContain('Scheduled for')
      })

      it('should add 5-minute buffer to scheduled retry time', () => {
        const futureTimestamp = Math.floor(Date.now() / 1000) + 3600
        const videoInfo: Partial<YtDlpVideoInfo> = {
          release_timestamp: futureTimestamp
        }
        const error = new Error('Video unavailable')

        const result = classifyVideoError(error, videoInfo)

        expect(result.retryAfter).toBe(futureTimestamp + 300)
      })
    })

    describe('livestream videos', () => {
      it('should detect upcoming livestream', () => {
        const futureTimestamp = Math.floor(Date.now() / 1000) + 7200
        const videoInfo: Partial<YtDlpVideoInfo> = {
          id: 'live123',
          is_live: false,
          live_status: 'upcoming',
          release_timestamp: futureTimestamp
        }
        const error = new Error('Livestream not started')

        const result = classifyVideoError(error, videoInfo)

        expect(result.category).toBe('livestream_upcoming')
        expect(result.retryable).toBe(true)
        expect(result.retryAfter).toBe(futureTimestamp)
        expect(result.reason).toBe('Livestream not yet started')
      })

      it('should use exponential backoff if no release_timestamp', () => {
        const videoInfo: Partial<YtDlpVideoInfo> = {
          is_live: false,
          live_status: 'upcoming'
        }
        const error = new Error('Livestream not started')

        const result = classifyVideoError(error, videoInfo)

        expect(result.category).toBe('livestream_upcoming')
        expect(result.retryable).toBe(true)
        expect(result.retryAfter).toBeDefined()
      })
    })

    describe('transient errors', () => {
      const networkErrors = [
        'ECONNRESET: Connection reset',
        'ETIMEDOUT: Operation timed out',
        'ENOTFOUND: Domain not found',
        'Network error occurred',
        'Connection timeout',
        'ECONNREFUSED: Connection refused',
        'socket hang up'
      ]

      networkErrors.forEach((errorMessage) => {
        it(`should detect transient error: ${errorMessage}`, () => {
          const error = new Error(errorMessage)

          const result = classifyVideoError(error)

          expect(result.category).toBe('transient')
          expect(result.retryable).toBe(true)
          expect(result.retryAfter).toBeDefined()
          expect(result.reason).toBe('Transient network error')
        })
      })
    })

    describe('permanent errors', () => {
      it('should classify unknown errors as permanent', () => {
        const error = new Error('Video is private')

        const result = classifyVideoError(error)

        expect(result.category).toBe('permanent')
        expect(result.retryable).toBe(false)
        expect(result.retryAfter).toBeUndefined()
        expect(result.reason).toBe('Video is private')
      })

      it('should classify geo-blocked videos as permanent', () => {
        const error = new Error('Video not available in your country')

        const result = classifyVideoError(error)

        expect(result.category).toBe('permanent')
        expect(result.retryable).toBe(false)
      })

      it('should classify deleted videos as permanent', () => {
        const error = new Error('Video has been removed')

        const result = classifyVideoError(error)

        expect(result.category).toBe('permanent')
        expect(result.retryable).toBe(false)
      })
    })

    describe('priority of classification', () => {
      it('should prioritize scheduled video over network error pattern', () => {
        const futureTimestamp = Math.floor(Date.now() / 1000) + 3600
        const videoInfo: Partial<YtDlpVideoInfo> = {
          release_timestamp: futureTimestamp
        }
        const error = new Error('ETIMEDOUT: Connection timeout')

        const result = classifyVideoError(error, videoInfo)

        expect(result.category).toBe('scheduled')
      })

      it('should prioritize livestream over network error', () => {
        const videoInfo: Partial<YtDlpVideoInfo> = {
          is_live: false,
          live_status: 'upcoming',
          release_timestamp: Math.floor(Date.now() / 1000) + 3600
        }
        const error = new Error('Network error')

        const result = classifyVideoError(error, videoInfo)

        expect(result.category).toBe('livestream_upcoming')
      })
    })
  })
})
