/**
 * Runtime Constants
 *
 * Centralized configuration values used across Lambda functions.
 * These are runtime values, not build-time constants.
 */

/** Default retry configuration for DynamoDB batch operations */
export const DEFAULT_RETRY_CONFIG = {MAX_RETRIES: 5, INITIAL_DELAY_MS: 100, MULTIPLIER: 2, MAX_DELAY_MS: 20000} as const

/** Batch processing configuration */
export const BATCH_PROCESSING = {
  /** Maximum items per batch for DynamoDB operations */
  BATCH_SIZE: 5,
  /** Delay between batches in milliseconds */
  BATCH_DELAY_MS: 10000
} as const

/** Session expiration times */
export const SESSION_CONFIG = {
  /** Session token expiration (30 days in milliseconds) */
  EXPIRATION_MS: 30 * 24 * 60 * 60 * 1000
} as const

/** Push notification configuration */
export const NOTIFICATION_CONFIG = {
  /** Maximum description length for APNS payload limits */
  MAX_DESCRIPTION_LENGTH: 500
} as const

/** HTTP status codes for consistent API responses */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  MULTI_STATUS: 207,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const
