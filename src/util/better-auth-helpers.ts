/**
 * Better Auth Helper Functions
 *
 * Utility functions for working with Better Auth sessions and tokens in Lambda functions.
 * These helpers bridge Better Auth's framework with our serverless architecture.
 */

import {Sessions} from '../entities/Sessions'
import {logDebug, logError} from './lambda-helpers'
import {UnauthorizedError} from './errors'

/**
 * Session payload extracted from token
 */
export interface SessionPayload {
  userId: string
  sessionId: string
  expiresAt: number
}

/**
 * Validates a session token and returns the session payload.
 *
 * @param token - The session token from Authorization header (without "Bearer " prefix)
 * @returns Session payload with userId and sessionId
 * @throws UnauthorizedError if token is invalid or expired
 */
export async function validateSessionToken(token: string): Promise<SessionPayload> \{
  logDebug('validateSessionToken: validating token')

  try \{
    // Note: Using scan instead of index lookup - consider adding token GSI if this becomes a bottleneck
    const result = await Sessions.scan.where((\{token: tokenAttr\}, \{eq\}) =\> eq(tokenAttr, token)).go()

    if (!result.data || result.data.length === 0) \{
      logError('validateSessionToken: session not found')
      throw new UnauthorizedError('Invalid session token')
    \}

    const session = result.data[0]

    if (session.expiresAt < Date.now()) \{
      logError('validateSessionToken: session expired', \{
        expiresAt: session.expiresAt,
        now: Date.now()
      \})
      throw new UnauthorizedError('Session expired')
    \}

    await Sessions.update(\{sessionId: session.sessionId\}).set(\{updatedAt: Date.now()\}).go()

    logDebug('validateSessionToken: session valid', \{
      userId: session.userId,
      sessionId: session.sessionId
    \})

    return \{
      userId: session.userId,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt
    \}
  \} catch (error) \{
    if (error instanceof UnauthorizedError) \{
      throw error
    \}
    logError('validateSessionToken: validation failed', \{error\})
    throw new UnauthorizedError('Token validation failed')
  \}
\}

/**
 * Creates a new session for a user after successful authentication.
 *
 * @param userId - The user ID to create a session for
 * @param deviceId - Optional device ID for device tracking
 * @param ipAddress - Optional IP address for security auditing
 * @param userAgent - Optional user agent for device identification
 * @returns Session token and expiration
 */
export async function createUserSession(userId: string, deviceId?: string, ipAddress?: string, userAgent?: string): Promise<\{token: string; expiresAt: number; sessionId: string\}> \{
  logDebug('createUserSession: creating session', {userId, deviceId})

  // Manual token generation since we're using ElectroDB adapter instead of Better Auth's built-in session management
  const token = generateSecureToken()
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

  const result = await Sessions.create({
    sessionId: generateSessionId(),
    userId,
    token,
    expiresAt,
    deviceId,
    ipAddress,
    userAgent
  }).go()

  logDebug('createUserSession: session created', {
    sessionId: result.data.sessionId,
    expiresAt
  })

  return {
    token,
    sessionId: result.data.sessionId,
    expiresAt
  }
}

/**
 * Revokes a session by ID.
 *
 * @param sessionId - The session ID to revoke
 */
export async function revokeSession(sessionId: string): Promise<void> {
  logDebug('revokeSession: revoking session', {sessionId})

  await Sessions.delete({sessionId}).go()

  logDebug('revokeSession: session revoked')
}

/**
 * Revokes all sessions for a user (logout from all devices).
 *
 * @param userId - The user ID to revoke all sessions for
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  logDebug('revokeAllUserSessions: revoking all sessions', {userId})

  const result = await Sessions.query.byUser({userId}).go()

  for (const session of result.data) {
    await Sessions.delete({sessionId: session.sessionId}).go()
  }

  logDebug('revokeAllUserSessions: revoked sessions', {count: result.data.length})
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

/**
 * Generates a cryptographically secure random session token.
 */
function generateSecureToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Buffer.from(bytes).toString('base64url')
}

/**
 * Generates a unique session ID.
 */
function generateSessionId(): string {
  return crypto.randomUUID()
}
