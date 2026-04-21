/**
 * CleanupExpiredRecords Lambda
 *
 * Scheduled Lambda that replaces DynamoDB TTL functionality.
 * Runs daily to delete expired records from Aurora DSQL.
 *
 * Trigger: CloudWatch Schedule (cron: daily at 3 AM UTC)
 * Input: ScheduledEvent
 * Output: CleanupResult with deletion counts
 *
 * @see {@link ../../../services/cleanup/cleanupService.ts} for cleanup operations
 */
import {defineScheduledHandler} from '@mantleframework/core'
import {addMetadata, endSpan, logDebug, logError, logInfo, metrics, MetricUnit, startSpan} from '@mantleframework/observability'
import type {CleanupResult} from '#types/lambda'
import {cleanupFileDownloads, cleanupSessions, cleanupVerificationTokens} from '#services/cleanup/cleanupService'

export type { CleanupResult }

const scheduled = defineScheduledHandler({operationName: 'CleanupExpiredRecords', schedule: {expression: 'cron(0 3 * * ? *)'}, timeout: 60})

export const handler = scheduled(async (): Promise<CleanupResult> => {
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

  const totalDeleted = result.fileDownloadsDeleted + result.sessionsDeleted + result.verificationTokensDeleted
  metrics.addMetric('RecordsCleanedUp', MetricUnit.Count, totalDeleted)
  addMetadata(span, 'fileDownloadsDeleted', result.fileDownloadsDeleted)
  addMetadata(span, 'sessionsDeleted', result.sessionsDeleted)
  addMetadata(span, 'verificationTokensDeleted', result.verificationTokensDeleted)
  addMetadata(span, 'totalDeleted', totalDeleted)
  addMetadata(span, 'errors', result.errors.length)
  endSpan(span)

  logInfo('CleanupExpiredRecords completed', result as unknown as Record<string, unknown>)
  return result
})
