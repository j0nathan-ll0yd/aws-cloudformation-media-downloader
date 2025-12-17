/**
 * Better Auth Helper Functions
 *
 * Utility functions for working with Better Auth sessions and tokens in Lambda functions.
 * These helpers bridge Better Auth's framework with our serverless architecture.
 */

import {Sessions} from '#entities/Sessions'
import {logDebug, logError} from './lambda-helpers'
import {UnauthorizedError} from './errors'
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
    // Note: Using scan instead of index lookup - consider adding token GSI if this becomes a bottleneck
    const result = await Sessions.scan.where(({token: tokenAttr}, {eq}) => eq(tokenAttr, token)).go()

    if (!result.data || result.data.length === 0) {
      logError('validateSessionToken: session not found')
      throw new UnauthorizedError('Invalid session token')
    }

    const session = result.data[0]

    if (session.expiresAt < Date.now()) {
      logError('validateSessionToken: session expired', {expiresAt: session.expiresAt, now: Date.now()})
      throw new UnauthorizedError('Session expired')
    }

    await Sessions.update({sessionId: session.sessionId}).set({updatedAt: Date.now()}).go()

    logDebug('validateSessionToken: session valid', {userId: session.userId, sessionId: session.sessionId})

    return {userId: session.userId, sessionId: session.sessionId, expiresAt: session.expiresAt}
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
 * @returns New expiration timestamp
 */
export async function refreshSession(sessionId: string): Promise<{expiresAt: number}> {
  logDebug('refreshSession: refreshing session', {sessionId})

  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days

  await Sessions.update({sessionId}).set({expiresAt, updatedAt: Date.now()}).go()

  logDebug('refreshSession: session refreshed', {expiresAt})

  return {expiresAt}
}
