import {describe, expect, test} from '@jest/globals'
import {classifyVideoError, calculateExponentialBackoff} from './video-error-classifier'
import {YtDlpVideoInfo} from '../types/youtube'

describe('classifyVideoError', () => {
  test('classifies scheduled video as retryable', () => {
    const error = new Error('This video is unavailable')
    const videoInfo: Partial<YtDlpVideoInfo> = {
      release_timestamp: Math.floor(Date.now() / 1000) + 86400,
      availability: 'public'
    }

    const result = classifyVideoError(error, videoInfo)

    expect(result.category).toBe('scheduled')
    expect(result.retryable).toBe(true)
    expect(result.retryAfter).toBeGreaterThan(Date.now() / 1000)
    expect(result.reason).toContain('Video scheduled for')
  })

  test('classifies private video as permanent failure', () => {
    const error = new Error('This video is unavailable')
    const videoInfo: Partial<YtDlpVideoInfo> = {availability: 'private'}

    const result = classifyVideoError(error, videoInfo)

    expect(result.category).toBe('permanent')
    expect(result.retryable).toBe(false)
    expect(result.reason).toBe('Video is private')
  })

  test('classifies cookie expiration error', () => {
    const error = new Error("Sign in to confirm you're not a bot")

    const result = classifyVideoError(error)

    expect(result.category).toBe('cookie_expired')
    expect(result.retryable).toBe(false)
    expect(result.reason).toBe('YouTube cookie authentication required')
  })

  test('classifies geo-blocked video as permanent failure', () => {
    const error = new Error('The uploader has not made this video available in your country')

    const result = classifyVideoError(error)

    expect(result.category).toBe('permanent')
    expect(result.retryable).toBe(false)
    expect(result.reason).toBe('Video geo-blocked in current region')
  })

  test('classifies unavailable video without metadata as permanent failure', () => {
    const error = new Error('This video is unavailable')

    const result = classifyVideoError(error)

    expect(result.category).toBe('permanent')
    expect(result.retryable).toBe(false)
    expect(result.reason).toBe('Video unavailable (likely deleted or never existed)')
  })

  test('classifies network error as transient', () => {
    const error = new Error('Network timeout occurred')

    const result = classifyVideoError(error)

    expect(result.category).toBe('transient')
    expect(result.retryable).toBe(true)
    expect(result.retryAfter).toBeGreaterThan(Date.now() / 1000)
    expect(result.reason).toBe('Transient network error')
  })

  test('classifies unknown error as permanent failure', () => {
    const error = new Error('Some unexpected error')

    const result = classifyVideoError(error)

    expect(result.category).toBe('permanent')
    expect(result.retryable).toBe(false)
    expect(result.reason).toBe('Some unexpected error')
  })
})

describe('calculateExponentialBackoff', () => {
  test('calculates exponential backoff correctly', () => {
    const now = Date.now() / 1000
    const retry0 = calculateExponentialBackoff(0, 3600)
    const retry1 = calculateExponentialBackoff(1, 3600)
    const retry2 = calculateExponentialBackoff(2, 3600)

    expect(retry0).toBeCloseTo(now + 3600, -2)
    expect(retry1).toBeCloseTo(now + 7200, -2)
    expect(retry2).toBeCloseTo(now + 14400, -2)
  })

  test('caps delay at maximum', () => {
    const now = Date.now() / 1000
    const maxDelay = 86400
    const retry10 = calculateExponentialBackoff(10, 3600, maxDelay)

    expect(retry10).toBeLessThanOrEqual(now + maxDelay + 1)
    expect(retry10).toBeGreaterThan(now + maxDelay - 1)
  })

  test('handles zero retry count', () => {
    const now = Date.now() / 1000
    const retry0 = calculateExponentialBackoff(0, 1800)

    expect(retry0).toBeCloseTo(now + 1800, -2)
  })
})
