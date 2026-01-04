/**
 * Authentication Helper Utilities
 *
 * Provides utilities for extracting and validating Bearer tokens
 * from HTTP Authorization headers. Used across multiple Lambda handlers.
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/TypeScript/Lambda-Function-Patterns | Lambda Function Patterns}
 */
import {UnauthorizedError} from '#lib/system/errors'
import type {AuthorizationHeaders} from '#types/util'

export type { AuthorizationHeaders }

/**
 * Extracts Bearer token from Authorization header.
 *
 * @param headers - Request headers object
 * @returns The extracted token string (without 'Bearer ' prefix)
 * @throws UnauthorizedError if header is missing or malformed
 *
 * @example
 * ```typescript
 * const token = extractBearerToken(event.headers)
 * ```
 */
export function extractBearerToken(headers: AuthorizationHeaders): string {
  const authHeader = headers.Authorization || headers.authorization
  if (!authHeader) {
    throw new UnauthorizedError('Missing Authorization header')
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    throw new UnauthorizedError('Invalid Authorization header format')
  }

  return match[1]
}

/**
 * Extracts Bearer token from Authorization header, returning null if not present.
 *
 * @param headers - Request headers object
 * @returns The extracted token string or null if not present
 *
 * @example
 * ```typescript
 * const token = extractBearerTokenOptional(event.headers)
 * ```
 */
export function extractBearerTokenOptional(headers: AuthorizationHeaders): string | null {
  const authHeader = headers.Authorization || headers.authorization
  if (!authHeader) {
    return null
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return null
  }

  return match[1]
}

/**
 * Validates Bearer token format without extracting.
 *
 * @param authHeader - Authorization header value
 * @returns true if valid Bearer token format
 *
 * @example
 * ```typescript
 * isValidBearerFormat('Bearer abc.xyz.123')  // true
 * ```
 */
export function isValidBearerFormat(authHeader: string): boolean {
  return /^Bearer\s+[A-Za-z0-9\-_=.]+$/i.test(authHeader)
}

/**
 * Checks if the Authorization header is present and non-empty.
 *
 * @param headers - Request headers object
 * @returns true if Authorization header exists
 */
export function hasAuthorizationHeader(headers: AuthorizationHeaders): boolean {
  const authHeader = headers.Authorization || headers.authorization
  return Boolean(authHeader && authHeader.length > 0)
}
