/**
 * CleanupExpiredRecords Lambda
 *
 * Scheduled Lambda that replaces DynamoDB TTL functionality.
 * Runs daily to delete expired records from Aurora DSQL.
 *
 * Records cleaned:
 * - FileDownloads: Completed/Failed downloads older than 24 hours
 * - Sessions: Expired sessions (expiresAt less than now)
 * - Verification: Expired tokens (expiresAt less than now)
 */
import {and, eq, lt, or} from '#lib/vendor/Drizzle/types'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {fileDownloads, sessions, verification} from '#lib/vendor/Drizzle/schema'
import {addMetadata, endSpan, startSpan} from '#lib/vendor/OpenTelemetry'
import type {CleanupResult} from '#types/lambda'
import {DatabaseOperation, DatabaseTable} from '#types/databasePermissions'
import {DownloadStatus} from '#types/enums'
import {metrics, MetricUnit, RequiresDatabase, ScheduledHandler} from '#lib/lambda/handlers'
import {logDebug, logError, logInfo} from '#lib/system/logging'
import {secondsAgo, TIME} from '#lib/system/time'

export type { CleanupResult }

/**
 * Deletes completed or failed FileDownloads older than 24 hours.
 * @returns Count of deleted records
 */
async function cleanupFileDownloads(): Promise<number> {
  const db = await getDrizzleClient()
  const cutoffTime = secondsAgo(TIME.DAY_SEC)

  const result = await db.delete(fileDownloads).where(
    and(or(eq(fileDownloads.status, DownloadStatus.Completed), eq(fileDownloads.status, DownloadStatus.Failed)), lt(fileDownloads.updatedAt, cutoffTime))
  ).returning({fileId: fileDownloads.fileId})

  return result.length
}

/**
 * Deletes expired sessions.
 * Sessions now use TIMESTAMP WITH TIME ZONE for expiresAt.
 * @returns Count of deleted records
 */
async function cleanupSessions(): Promise<number> {
  const db = await getDrizzleClient()
  const now = new Date()

  const result = await db.delete(sessions).where(lt(sessions.expiresAt, now)).returning({id: sessions.id})

  return result.length
}

/**
 * Deletes expired verification tokens.
 * Verification table uses TIMESTAMP WITH TIME ZONE for expiresAt.
 * @returns Count of deleted records
 */
async function cleanupVerificationTokens(): Promise<number> {
  const db = await getDrizzleClient()
  const now = new Date()

  const result = await db.delete(verification).where(lt(verification.expiresAt, now)).returning({id: verification.id})

  return result.length
}

/**
 * Handler for scheduled expired record cleanup.
 * Deletes expired FileDownloads, Sessions, and Verification tokens.
 */
@RequiresDatabase([
  {table: DatabaseTable.FileDownloads, operations: [DatabaseOperation.Delete]},
  {table: DatabaseTable.Sessions, operations: [DatabaseOperation.Delete]},
  {table: DatabaseTable.VerificationTokens, operations: [DatabaseOperation.Delete]}
])
class CleanupExpiredRecordsHandler extends ScheduledHandler<CleanupResult> {
  readonly operationName = 'CleanupExpiredRecords'

  protected async executeScheduled(): Promise<CleanupResult> {
    // Track cleanup run
    metrics.addMetric('CleanupRun', MetricUnit.Count, 1)

    const span = startSpan('cleanup-records')

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
      result.errors.push(`Verification cleanup failed: ${message}`)
    }

    // Track total records cleaned up
    const totalDeleted = result.fileDownloadsDeleted + result.sessionsDeleted + result.verificationTokensDeleted
    metrics.addMetric('RecordsCleanedUp', MetricUnit.Count, totalDeleted)
    addMetadata(span, 'fileDownloadsDeleted', result.fileDownloadsDeleted)
    addMetadata(span, 'sessionsDeleted', result.sessionsDeleted)
    addMetadata(span, 'verificationTokensDeleted', result.verificationTokensDeleted)
    addMetadata(span, 'totalDeleted', totalDeleted)
    addMetadata(span, 'errors', result.errors.length)
    endSpan(span)

    logInfo('CleanupExpiredRecords completed', result)
    return result
  }
}

const handlerInstance = new CleanupExpiredRecordsHandler()
export const handler = handlerInstance.handler.bind(handlerInstance)
