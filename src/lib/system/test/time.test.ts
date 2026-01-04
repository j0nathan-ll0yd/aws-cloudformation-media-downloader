import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {
  isExpired,
  isFuture,
  isPast,
  millisecondsAgo,
  millisecondsFromNow,
  msToISOString,
  nowISO,
  secondsAgo,
  secondsFromNow,
  TIME,
  unixToDate,
  unixToISOString
} from '../time'

describe('time', () => {
  const fixedNow = new Date('2024-06-15T12:00:00.000Z').getTime()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(fixedNow)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('TIME constants', () => {
    it('should have correct second values', () => {
      expect(TIME.MINUTE_SEC).toBe(60)
      expect(TIME.HOUR_SEC).toBe(3600)
      expect(TIME.DAY_SEC).toBe(86400)
      expect(TIME.WEEK_SEC).toBe(604800)
      expect(TIME.MONTH_SEC).toBe(2592000)
    })

    it('should have correct millisecond values', () => {
      expect(TIME.MINUTE_MS).toBe(60000)
      expect(TIME.HOUR_MS).toBe(3600000)
      expect(TIME.DAY_MS).toBe(86400000)
      expect(TIME.WEEK_MS).toBe(604800000)
      expect(TIME.MONTH_MS).toBe(2592000000)
    })

    it('should have consistent second-to-millisecond relationship', () => {
      expect(TIME.MINUTE_MS).toBe(TIME.MINUTE_SEC * 1000)
      expect(TIME.HOUR_MS).toBe(TIME.HOUR_SEC * 1000)
      expect(TIME.DAY_MS).toBe(TIME.DAY_SEC * 1000)
      expect(TIME.WEEK_MS).toBe(TIME.WEEK_SEC * 1000)
      expect(TIME.MONTH_MS).toBe(TIME.MONTH_SEC * 1000)
    })
  })

  describe('secondsAgo', () => {
    it('should return date in the past', () => {
      const result = secondsAgo(3600) // 1 hour ago

      expect(result.getTime()).toBe(fixedNow - 3600000)
    })

    it('should return current time for 0 seconds', () => {
      const result = secondsAgo(0)

      expect(result.getTime()).toBe(fixedNow)
    })

    it('should work with TIME constants', () => {
      const result = secondsAgo(TIME.DAY_SEC)

      expect(result.getTime()).toBe(fixedNow - TIME.DAY_MS)
    })
  })

  describe('secondsFromNow', () => {
    it('should return date in the future', () => {
      const result = secondsFromNow(3600) // 1 hour from now

      expect(result.getTime()).toBe(fixedNow + 3600000)
    })

    it('should return current time for 0 seconds', () => {
      const result = secondsFromNow(0)

      expect(result.getTime()).toBe(fixedNow)
    })

    it('should work with TIME constants', () => {
      const result = secondsFromNow(TIME.DAY_SEC)

      expect(result.getTime()).toBe(fixedNow + TIME.DAY_MS)
    })
  })

  describe('millisecondsAgo', () => {
    it('should return date in the past', () => {
      const result = millisecondsAgo(5000)

      expect(result.getTime()).toBe(fixedNow - 5000)
    })

    it('should work with TIME constants', () => {
      const result = millisecondsAgo(TIME.HOUR_MS)

      expect(result.getTime()).toBe(fixedNow - TIME.HOUR_MS)
    })
  })

  describe('millisecondsFromNow', () => {
    it('should return date in the future', () => {
      const result = millisecondsFromNow(5000)

      expect(result.getTime()).toBe(fixedNow + 5000)
    })

    it('should work with TIME constants', () => {
      const result = millisecondsFromNow(TIME.HOUR_MS)

      expect(result.getTime()).toBe(fixedNow + TIME.HOUR_MS)
    })
  })

  describe('unixToISOString', () => {
    it('should convert Unix timestamp to ISO string', () => {
      const unixTimestamp = 1718452800 // 2024-06-15T12:00:00Z

      const result = unixToISOString(unixTimestamp)

      expect(result).toBe('2024-06-15T12:00:00.000Z')
    })

    it('should handle zero timestamp', () => {
      const result = unixToISOString(0)

      expect(result).toBe('1970-01-01T00:00:00.000Z')
    })
  })

  describe('unixToDate', () => {
    it('should convert Unix timestamp to Date', () => {
      const unixTimestamp = 1718452800 // 2024-06-15T12:00:00Z

      const result = unixToDate(unixTimestamp)

      expect(result).toBeInstanceOf(Date)
      expect(result.getTime()).toBe(1718452800000)
    })
  })

  describe('msToISOString', () => {
    it('should convert milliseconds timestamp to ISO string', () => {
      const msTimestamp = 1718452800000 // 2024-06-15T12:00:00Z

      const result = msToISOString(msTimestamp)

      expect(result).toBe('2024-06-15T12:00:00.000Z')
    })
  })

  describe('nowISO', () => {
    it('should return current time as ISO string', () => {
      const result = nowISO()

      expect(result).toBe('2024-06-15T12:00:00.000Z')
    })
  })

  describe('isPast', () => {
    it('should return true for past dates', () => {
      const pastDate = new Date(fixedNow - 1000)

      expect(isPast(pastDate)).toBe(true)
    })

    it('should return false for future dates', () => {
      const futureDate = new Date(fixedNow + 1000)

      expect(isPast(futureDate)).toBe(false)
    })

    it('should return false for current time', () => {
      const now = new Date(fixedNow)

      expect(isPast(now)).toBe(false)
    })
  })

  describe('isFuture', () => {
    it('should return true for future dates', () => {
      const futureDate = new Date(fixedNow + 1000)

      expect(isFuture(futureDate)).toBe(true)
    })

    it('should return false for past dates', () => {
      const pastDate = new Date(fixedNow - 1000)

      expect(isFuture(pastDate)).toBe(false)
    })

    it('should return false for current time', () => {
      const now = new Date(fixedNow)

      expect(isFuture(now)).toBe(false)
    })
  })

  describe('isExpired', () => {
    it('should return true for expired timestamps', () => {
      const expiredTimestamp = Math.floor(fixedNow / 1000) - 3600 // 1 hour ago

      expect(isExpired(expiredTimestamp)).toBe(true)
    })

    it('should return false for future timestamps', () => {
      const futureTimestamp = Math.floor(fixedNow / 1000) + 3600 // 1 hour from now

      expect(isExpired(futureTimestamp)).toBe(false)
    })

    it('should return false for current timestamp', () => {
      const currentTimestamp = Math.floor(fixedNow / 1000)

      expect(isExpired(currentTimestamp)).toBe(false)
    })
  })
})
