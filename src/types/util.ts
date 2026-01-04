/**
 * Utility Types
 *
 * Shared type definitions for utility functions across the codebase.
 *
 * @see src/util/retry.ts - Retry utilities
 * @see src/util/better-auth-helpers.ts - Authentication helpers
 * @see src/util/lambda-helpers.ts - Lambda handler utilities
 */

import {UserStatus} from './enums'

/**
 * Configuration options for retry behavior with exponential backoff
 */
export interface RetryConfig {
  maxRetries?: number
  initialDelayMs?: number
  multiplier?: number
  maxDelayMs?: number
}

/**
 * Session payload extracted from Better Auth token
 */
export interface SessionPayload {
  userId: string
  sessionId: string
  expiresAt: number
}

/**
 * User details extracted from API Gateway event
 */
export interface UserEventDetails {
  userId?: string
  userStatus: UserStatus
}

/**
 * Result of separating Promise.allSettled outcomes.
 * @see src/lib/system/batch.ts
 */
export interface SeparatedBatchResults<T> {
  succeeded: T[]
  failed: Error[]
}

/**
 * Counts of success/failure from Promise.allSettled.
 * @see src/lib/system/batch.ts
 */
export interface BatchResultCounts {
  successCount: number
  failureCount: number
}

/**
 * Headers object type with optional Authorization header.
 * Supports both capitalized and lowercase forms.
 * @see src/lib/lambda/auth-helpers.ts
 */
export type AuthorizationHeaders = Record<string, string | undefined> & {Authorization?: string; authorization?: string}
