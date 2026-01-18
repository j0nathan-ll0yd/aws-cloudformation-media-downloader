/**
 * Better Auth Helper Functions
 *
 * Utility functions for working with Better Auth sessions and tokens in Lambda functions.
 * These helpers bridge Better Auth's framework with our serverless architecture.
 */

import {getSessionByToken, updateSession} from '#entities/queries'
import {logDebug, logError} from '#lib/system/logging'
import {UnauthorizedError} from '#lib/system/errors'
import type {SessionPayload} from '#types/util'

/**
 * Validates a session token and returns the session payload.
 *
 * @param token - The session token from Authorization header (without "Bearer " prefix)
 * @returns Session payload with userId and sessionId
 * @throws UnauthorizedError if token is invalid or expired
 */
export async function validateSessionToken(token: string): Promise<SessionPayload> {
  logDebug('validateSessionToken: validating token', {tokenLength: token.length, tokenPrefix: token.substring(0, 8)})

  // Use index for O(1) lookup
  const session = await getSessionByToken(token)

  if (!session) {
    logError('validateSessionToken: session not found', {tokenPrefix: token.substring(0, 8), tokenLength: token.length})
    throw new UnauthorizedError('Invalid session token')
  }

  // Compare Date objects - expiresAt is now a TIMESTAMP WITH TIME ZONE
  if (session.expiresAt < new Date()) {
    logError('validateSessionToken: session expired', {expiresAt: session.expiresAt.toISOString(), now: new Date().toISOString()})
    throw new UnauthorizedError('Session expired')
  }

  await updateSession(session.id, {updatedAt: new Date()})

  logDebug('validateSessionToken: session valid', {userId: session.userId, sessionId: session.id})

  return {userId: session.userId, sessionId: session.id, expiresAt: session.expiresAt.getTime()}
}

/**
 * Refreshes a session by extending its expiration.
 *
 * @param sessionId - The session ID to refresh
 * @returns New expiration timestamp (milliseconds since epoch)
 */
export async function refreshSession(sessionId: string): Promise<{expiresAt: number}> {
  logDebug('refreshSession: refreshing session', {sessionId})

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  await updateSession(sessionId, {expiresAt, updatedAt: new Date()})

  logDebug('refreshSession: session refreshed', {expiresAt: expiresAt.toISOString()})

  return {expiresAt: expiresAt.getTime()}
}
