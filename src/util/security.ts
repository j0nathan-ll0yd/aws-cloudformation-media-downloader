/**
 * Security utilities for PII protection and data sanitization.
 * Provides centralized data redaction for both test fixtures and runtime logging.
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Security/PII-Protection | PII Protection Guide}
 */

/**
 * Sanitize data by removing sensitive fields (PII, credentials).
 * Recursively processes objects and arrays to redact sensitive information.
 *
 * Used for:
 * - Test fixture generation (sanitizeForTest in lambda-helpers.ts)
 * - Runtime debug logging (logDebug in logging.ts)
 *
 * @param data - Data to sanitize
 * @returns Sanitized copy of data with sensitive fields redacted
 *
 * @example
 * ```typescript
 * const sanitized = sanitizeData({
 *   email: 'user@example.com',
 *   token: 'secret123',
 *   safeField: 'visible'
 * })
 * // Returns: { email: '[REDACTED]', token: '[REDACTED]', safeField: 'visible' }
 * ```
 */
export function sanitizeData(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item))
  }

  const sanitized: Record<string, unknown> = {...(data as Record<string, unknown>)}

  // Remove sensitive fields - case-insensitive patterns for comprehensive PII protection
  const sensitivePatterns = [
    /^authorization$/i, // fmt: multiline
    /^token$/i,
    /^deviceToken$/i,
    /^refreshToken$/i,
    /^accessToken$/i,
    /^password$/i,
    /^apiKey$/i,
    /^secret$/i,
    /^privateKey$/i,
    /^appleDeviceIdentifier$/i,
    /^email$/i,
    /^phoneNumber$/i,
    /^phone$/i,
    /^certificate$/i,
    /^ssn$/i,
    /^creditCard$/i
  ]

  for (const key in sanitized) {
    if (sensitivePatterns.some((pattern) => pattern.test(key))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key])
    }
  }

  return sanitized
}
