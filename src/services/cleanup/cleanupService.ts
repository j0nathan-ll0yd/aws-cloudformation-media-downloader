/**
 * Cleanup Service
 *
 * Database cleanup operations for expired records.
 * Used by the CleanupExpiredRecords scheduled Lambda.
 */
import {and, eq, lt, or} from '@mantleframework/database/orm'
import {getDrizzleClient} from '#db/client'
import {fileDownloads, sessions, verification} from '#db/schema'
import {DownloadStatus} from '#types/enums'
import {secondsAgo, TIME} from '#utils/time'

/**
 * Deletes completed or failed FileDownloads older than 24 hours.
 * @returns Count of deleted records
 */
export async function cleanupFileDownloads(): Promise<number> {
  const db = await getDrizzleClient()
  const cutoffTime = secondsAgo(TIME.DAY_SEC)

  // mantle-ignore: grandfathered(C10, #88, expires:2026-07-20)
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
export async function cleanupSessions(): Promise<number> {
  const db = await getDrizzleClient()
  const now = new Date()

  // mantle-ignore: grandfathered(C10, #88, expires:2026-07-20)
  const result = await db.delete(sessions).where(lt(sessions.expiresAt, now)).returning({id: sessions.id})

  return result.length
}

/**
 * Deletes expired verification tokens.
 * Verification table uses TIMESTAMP WITH TIME ZONE for expiresAt.
 * @returns Count of deleted records
 */
export async function cleanupVerificationTokens(): Promise<number> {
  const db = await getDrizzleClient()
  const now = new Date()

  // mantle-ignore: grandfathered(C10, #88, expires:2026-07-20)
  const result = await db.delete(verification).where(lt(verification.expiresAt, now)).returning({id: verification.id})

  return result.length
}
