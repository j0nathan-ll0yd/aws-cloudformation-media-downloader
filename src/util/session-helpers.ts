import {v4 as uuidv4} from 'uuid'
import {Sessions} from '../entities/Sessions'
import {logDebug, logInfo} from './lambda-helpers'
import {createAccessToken, createRefreshToken, validateRefreshToken} from './jwt-helpers'
import {UnauthorizedError} from './errors'

const REFRESH_TOKEN_EXPIRY_DAYS = 30
const SESSION_CLEANUP_THRESHOLD = 5

/**
 * Creates a new session for a user
 * @param userId - The user ID
 * @param deviceId - Optional device identifier
 * @param ipAddress - Client IP address
 * @param userAgent - Client user agent
 * @returns Session with access and refresh tokens
 */
export async function createSession(
  userId: string,
  deviceId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{accessToken: string; refreshToken: string; expiresAt: number}> {
  const sessionId = uuidv4()
  const refreshToken = await createRefreshToken(userId, sessionId)
  const accessToken = await createAccessToken(userId, sessionId)

  const expiresAt = Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000

  logDebug('createSession', {userId, sessionId, deviceId})

  await Sessions.create({
    sessionId,
    userId,
    refreshToken,
    deviceId,
    ipAddress,
    userAgent,
    expiresAt,
    lastActiveAt: Date.now()
  }).go()

  await cleanupUserSessions(userId)

  return {accessToken, refreshToken, expiresAt}
}

/**
 * Refreshes an access token using a refresh token
 * @param refreshToken - The refresh token
 * @returns New access token
 * @throws UnauthorizedError if session is invalid or expired
 */
export async function refreshAccessToken(refreshToken: string): Promise<{accessToken: string}> {
  const {userId, sessionId} = await validateRefreshToken(refreshToken)

  const sessionResult = await Sessions.get({sessionId}).go()
  const session = sessionResult.data

  if (!session) {
    throw new UnauthorizedError('Session not found')
  }

  if (session.expiresAt < Date.now()) {
    throw new UnauthorizedError('Session expired')
  }

  if (session.refreshToken !== refreshToken) {
    throw new UnauthorizedError('Invalid refresh token')
  }

  await Sessions.update({sessionId}).set({lastActiveAt: Date.now()}).go()

  const accessToken = await createAccessToken(userId, sessionId)
  return {accessToken}
}

/**
 * Revokes a session
 * @param sessionId - The session ID to revoke
 */
export async function revokeSession(sessionId: string): Promise<void> {
  logInfo('revokeSession', {sessionId})
  await Sessions.delete({sessionId}).go()
}

/**
 * Revokes all sessions for a user
 * @param userId - The user ID
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  logInfo('revokeAllUserSessions', {userId})

  const sessionsResult = await Sessions.query.byUser({userId}).go()
  const sessions = sessionsResult.data || []

  if (sessions.length > 0) {
    const sessionIds = sessions.map((s) => ({sessionId: s.sessionId}))
    await Sessions.delete(sessionIds).go()
  }
}

/**
 * Cleans up expired and excess sessions for a user
 * @param userId - The user ID
 */
async function cleanupUserSessions(userId: string): Promise<void> {
  const sessionsResult = await Sessions.query.byUser({userId}).go()
  const sessions = sessionsResult.data || []

  const now = Date.now()
  const validSessions = sessions.filter((s) => s.expiresAt > now)

  const expiredSessions = sessions.filter((s) => s.expiresAt <= now)
  if (expiredSessions.length > 0) {
    const expiredIds = expiredSessions.map((s) => ({sessionId: s.sessionId}))
    await Sessions.delete(expiredIds).go()
  }

  if (validSessions.length > SESSION_CLEANUP_THRESHOLD) {
    const sortedSessions = validSessions.sort((a, b) => a.lastActiveAt - b.lastActiveAt)
    const toRemove = sortedSessions.slice(0, validSessions.length - SESSION_CLEANUP_THRESHOLD)
    const toRemoveIds = toRemove.map((s) => ({sessionId: s.sessionId}))
    await Sessions.delete(toRemoveIds).go()
  }
}
