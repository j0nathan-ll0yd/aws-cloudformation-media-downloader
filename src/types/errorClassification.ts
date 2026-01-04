/**
 * Generic error categories applicable across all domains.
 * Used to determine retry behavior and alerting.
 */
export type ErrorCategory =
  | 'transient' // Network/temporary issues, exponential backoff
  | 'permanent' // Unrecoverable, no retry
  | 'auth_expired' // Token/session expired, requires re-auth
  | 'auth_invalid' // Invalid credentials, no retry
  | 'rate_limited' // Rate limit hit, retry with longer delay
  | 'configuration' // Missing config/env vars, requires fix
  | 'validation' // Invalid input, no retry

/**
 * Result of classifying any error.
 * Provides consistent retry strategy across all domains.
 */
export interface ErrorClassification {
  /** The category of error determining retry behavior */
  category: ErrorCategory
  /** Whether this error is retryable */
  retryable: boolean
  /** Suggested delay in ms before retry (undefined if not retryable) */
  retryDelayMs?: number
  /** Maximum retry attempts for this category */
  maxRetries: number
  /** Human-readable reason for the classification */
  reason: string
  /** Should this error create a GitHub issue? */
  createIssue: boolean
  /** Issue severity if createIssue is true */
  issuePriority?: 'low' | 'normal' | 'high' | 'critical'
}

/** Supported error domains for classification */
export type ErrorDomain = 'auth' | 'database' | 'external-api'

/** Options for error classification */
export interface ClassifyErrorOptions {
  /** Service name for external API errors (required for 'external-api' domain) */
  serviceName?: string
}
