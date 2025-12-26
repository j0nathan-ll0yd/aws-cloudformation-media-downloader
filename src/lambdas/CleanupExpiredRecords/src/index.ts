/**
 * CleanupExpiredRecords Lambda
 *
 * Scheduled Lambda that replaces DynamoDB TTL functionality.
 * Runs daily to delete expired records from Aurora DSQL.
 *
 * Records cleaned:
 * - FileDownloads: Completed/Failed downloads older than 24 hours
 * - Sessions: Expired sessions (expiresAt less than now)
 * - VerificationTokens: Expired tokens (expiresAt less than now)
 */
import {and, eq, lt, or} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {fileDownloads, sessions, verificationTokens} from '#lib/vendor/Drizzle/schema'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapScheduledHandler} from '#lib/lambda/middleware/internal'
import {logDebug, logError, logInfo} from '#lib/system/logging'

export interface CleanupResult {
  fileDownloadsDeleted: number
  sessionsDeleted: number
  verificationTokensDeleted: number
  errors: string[]
}

const TWENTY_FOUR_HOURS_SEC = 24 * 60 * 60

/**
 * Deletes completed or failed FileDownloads older than 24 hours.
 * @returns Count of deleted records
 */
async function cleanupFileDownloads(): Promise<number> {
  const db = await getDrizzleClient()
  const cutoffTime = Math.floor(Date.now() / 1000) - TWENTY_FOUR_HOURS_SEC

  const result = await db.delete(fileDownloads).where(
    and(or(eq(fileDownloads.status, 'Completed'), eq(fileDownloads.status, 'Failed')), lt(fileDownloads.updatedAt, cutoffTime))
  ).returning({fileId: fileDownloads.fileId})

  return result.length
}

/**
 * Deletes expired sessions.
 * @returns Count of deleted records
 */
async function cleanupSessions(): Promise<number> {
  const db = await getDrizzleClient()
  const now = Math.floor(Date.now() / 1000)

  const result = await db.delete(sessions).where(lt(sessions.expiresAt, now)).returning({sessionId: sessions.sessionId})

  return result.length
}

/**
 * Deletes expired verification tokens.
 * @returns Count of deleted records
 */
async function cleanupVerificationTokens(): Promise<number> {
  const db = await getDrizzleClient()
  const now = Math.floor(Date.now() / 1000)

  const result = await db.delete(verificationTokens).where(lt(verificationTokens.expiresAt, now)).returning({token: verificationTokens.token})

  return result.length
}

/**
 * Scheduled handler that cleans up expired records.
 *
 * Runs daily at 3 AM UTC to delete:
 * - FileDownloads: Completed/Failed older than 24 hours
 * - Sessions: expiresAt in the past
 * - VerificationTokens: expiresAt in the past
 *
 * @returns CleanupResult with counts of deleted records
 */
export const handler = withPowertools(wrapScheduledHandler(async (): Promise<CleanupResult> => {
  const result: CleanupResult = {fileDownloadsDeleted: 0, sessionsDeleted: 0, verificationTokensDeleted: 0, errors: []}

  logInfo('CleanupExpiredRecords starting')

  try {
    result.fileDownloadsDeleted = await cleanupFileDownloads()
    logDebug('Cleaned up file downloads', {count: result.fileDownloadsDeleted})
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logError('Failed to cleanup file downloads', {error: message})
    result.errors.push(`FileDownloads cleanup failed: ${message}`)
  }

  try {
    result.sessionsDeleted = await cleanupSessions()
    logDebug('Cleaned up sessions', {count: result.sessionsDeleted})
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logError('Failed to cleanup sessions', {error: message})
    result.errors.push(`Sessions cleanup failed: ${message}`)
  }

  try {
    result.verificationTokensDeleted = await cleanupVerificationTokens()
    logDebug('Cleaned up verification tokens', {count: result.verificationTokensDeleted})
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logError('Failed to cleanup verification tokens', {error: message})
    result.errors.push(`VerificationTokens cleanup failed: ${message}`)
  }

  logInfo('CleanupExpiredRecords completed', result)
  return result
}))
