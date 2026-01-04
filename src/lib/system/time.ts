/**
 * Time Constants and Utilities
 *
 * Provides time-related constants and helper functions for consistent
 * date/time handling across Lambda handlers.
 *
 * Eliminates magic numbers like:
 * ```typescript
 * const TWENTY_FOUR_HOURS_SEC = 24 * 60 * 60
 * const cutoffTime = new Date(Date.now() - TWENTY_FOUR_HOURS_SEC * 1000)
 * ```
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/TypeScript/System-Library | System Library Guide}
 */

/**
 * Time constants in various units for consistent usage across handlers.
 *
 * @example
 * ```typescript
 * const cutoffTime = new Date(Date.now() - TIME.DAY_MS)
 * ```
 */
export const TIME = {
  /** Seconds in one minute (60) */
  MINUTE_SEC: 60,
  /** Seconds in one hour (3,600) */
  HOUR_SEC: 60 * 60,
  /** Seconds in 24 hours (86,400) */
  DAY_SEC: 24 * 60 * 60,
  /** Seconds in 7 days (604,800) */
  WEEK_SEC: 7 * 24 * 60 * 60,
  /** Seconds in 30 days (2,592,000) */
  MONTH_SEC: 30 * 24 * 60 * 60,

  /** Milliseconds in one minute (60,000) */
  MINUTE_MS: 60 * 1000,
  /** Milliseconds in one hour (3,600,000) */
  HOUR_MS: 60 * 60 * 1000,
  /** Milliseconds in 24 hours (86,400,000) */
  DAY_MS: 24 * 60 * 60 * 1000,
  /** Milliseconds in 7 days (604,800,000) */
  WEEK_MS: 7 * 24 * 60 * 60 * 1000,
  /** Milliseconds in 30 days (2,592,000,000) */
  MONTH_MS: 30 * 24 * 60 * 60 * 1000
} as const

/**
 * Creates a Date representing a time in the past.
 *
 * @param seconds - Number of seconds ago
 * @returns Date object representing that time
 *
 * @example
 * ```typescript
 * const cutoffTime = secondsAgo(TIME.DAY_SEC)
 * ```
 */
export function secondsAgo(seconds: number): Date {
  return new Date(Date.now() - seconds * 1000)
}

/**
 * Creates a Date representing a time in the future.
 *
 * @param seconds - Number of seconds from now
 * @returns Date object representing that time
 *
 * @example
 * ```typescript
 * const expiresAt = secondsFromNow(TIME.HOUR_SEC)
 * ```
 */
export function secondsFromNow(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000)
}

/**
 * Creates a Date representing a time in the past.
 *
 * @param milliseconds - Number of milliseconds ago
 * @returns Date object representing that time
 */
export function millisecondsAgo(milliseconds: number): Date {
  return new Date(Date.now() - milliseconds)
}

/**
 * Creates a Date representing a time in the future.
 *
 * @param milliseconds - Number of milliseconds from now
 * @returns Date object representing that time
 */
export function millisecondsFromNow(milliseconds: number): Date {
  return new Date(Date.now() + milliseconds)
}

/**
 * Converts Unix timestamp (seconds since epoch) to ISO string.
 *
 * @param timestampSec - Unix timestamp in seconds
 * @returns ISO 8601 date string
 *
 * @example
 * ```typescript
 * unixToISOString(token.iat)  // "2024-01-15T10:30:00.000Z"
 * ```
 */
export function unixToISOString(timestampSec: number): string {
  return new Date(timestampSec * 1000).toISOString()
}

/**
 * Converts Unix timestamp (seconds since epoch) to Date object.
 *
 * @param timestampSec - Unix timestamp in seconds
 * @returns Date object
 */
export function unixToDate(timestampSec: number): Date {
  return new Date(timestampSec * 1000)
}

/**
 * Converts milliseconds timestamp to ISO string.
 *
 * @param timestampMs - Timestamp in milliseconds
 * @returns ISO 8601 date string
 */
export function msToISOString(timestampMs: number): string {
  return new Date(timestampMs).toISOString()
}

/**
 * Gets current time as ISO string.
 * Convenience function for consistent timestamp generation.
 *
 * @returns Current time as ISO 8601 string
 */
export function nowISO(): string {
  return new Date().toISOString()
}

/**
 * Checks if a date is in the past.
 *
 * @param date - Date to check
 * @returns true if the date is before now
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now()
}

/**
 * Checks if a date is in the future.
 *
 * @param date - Date to check
 * @returns true if the date is after now
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now()
}

/**
 * Checks if a timestamp (seconds) is in the past.
 *
 * @param timestampSec - Unix timestamp in seconds
 * @returns true if the timestamp is before now
 */
export function isExpired(timestampSec: number): boolean {
  return timestampSec * 1000 < Date.now()
}
