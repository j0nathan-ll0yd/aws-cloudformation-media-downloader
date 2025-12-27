/**
 * Better Auth Helper Functions
 *
 * Utility functions for working with Better Auth sessions and tokens in Lambda functions.
 * These helpers bridge Better Auth's framework with our serverless architecture.
 */

import {Sessions} from '#entities/Sessions'
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
  logDebug('validateSessionToken: validating token')
  try {
    // Use GSI for O(1) lookup instead of table scan
    const result = await Sessions.query.byToken({token}).go()

    if (!result.data || result.data.length === 0) {
      logError('validateSessionToken: session not found')
      throw new UnauthorizedError('Invalid session token')
    }

    const session = result.data[0]

    // Compare Date objects - expiresAt is now a TIMESTAMP WITH TIME ZONE
    if (session.expiresAt < new Date()) {
      logError('validateSessionToken: session expired', {expiresAt: session.expiresAt.toISOString(), now: new Date().toISOString()})
      throw new UnauthorizedError('Session expired')
    }

    await Sessions.update({id: session.id}).set({updatedAt: new Date()}).go()

    logDebug('validateSessionToken: session valid', {userId: session.userId, sessionId: session.id})

    return {userId: session.userId, sessionId: session.id, expiresAt: session.expiresAt.getTime()}
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    logError('validateSessionToken: validation failed', {error})
    throw new UnauthorizedError('Token validation failed')
  }
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

  await Sessions.update({id: sessionId}).set({expiresAt, updatedAt: new Date()}).go()

  logDebug('refreshSession: session refreshed', {expiresAt: expiresAt.toISOString()})

  return {expiresAt: expiresAt.getTime()}
}
