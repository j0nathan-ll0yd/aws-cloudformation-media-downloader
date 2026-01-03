/**
 * Prepared Queries for Performance-Critical Paths
 *
 * Prepared statements are cached across Lambda invocations,
 * providing 10-15% performance improvement for frequently-called queries.
 *
 * Usage pattern:
 * 1. Create lazy-initialized prepared statement
 * 2. Export wrapper function that uses the prepared statement
 * 3. Prepared statement is reused across Lambda warm starts
 *
 * @see {@link https://orm.drizzle.team/docs/perf-queries | Drizzle Prepared Statements}
 */
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {files, sessions, userFiles} from '#lib/vendor/Drizzle/schema'
import {eq, sql} from '#lib/vendor/Drizzle/types'
import type {FileRow} from './file-queries'
import type {SessionRow} from './session-queries'

// Lazy initialization pattern for Lambda cold starts
// These are cached at module scope and reused across invocations
let preparedGetFileByKey: ReturnType<typeof createPreparedGetFileByKey> | null = null
let preparedGetUserFiles: ReturnType<typeof createPreparedGetUserFiles> | null = null
let preparedGetSessionByToken: ReturnType<typeof createPreparedGetSessionByToken> | null = null

type DrizzleClient = Awaited<ReturnType<typeof getDrizzleClient>>

function createPreparedGetFileByKey(db: DrizzleClient) {
  return db.select().from(files).where(eq(files.key, sql.placeholder('key'))).prepare('get_file_by_key')
}

function createPreparedGetUserFiles(db: DrizzleClient) {
  return db.select({file: files}).from(userFiles).innerJoin(files, eq(userFiles.fileId, files.fileId)).where(eq(userFiles.userId, sql.placeholder('userId')))
    .prepare('get_user_files')
}

function createPreparedGetSessionByToken(db: DrizzleClient) {
  return db.select().from(sessions).where(eq(sessions.token, sql.placeholder('token'))).limit(1).prepare('get_session_by_token')
}

/**
 * Gets a file by S3 key using a prepared statement.
 * Use this for hot paths like S3ObjectCreated Lambda.
 * @param key - The S3 object key
 * @returns The file row or null if not found
 */
export async function getFileByKeyPrepared(key: string): Promise<FileRow | null> {
  const db = await getDrizzleClient()
  if (!preparedGetFileByKey) {
    preparedGetFileByKey = createPreparedGetFileByKey(db)
  }
  const results = await preparedGetFileByKey.execute({key})
  return results[0] ?? null
}

/**
 * Gets all files for a user using a prepared statement.
 * Use this for hot paths like ListFiles Lambda.
 * @param userId - The user's unique identifier
 * @returns Array of file rows
 */
export async function getUserFilesPrepared(userId: string): Promise<FileRow[]> {
  const db = await getDrizzleClient()
  if (!preparedGetUserFiles) {
    preparedGetUserFiles = createPreparedGetUserFiles(db)
  }
  const results = await preparedGetUserFiles.execute({userId})
  return results.map((r) => r.file)
}

/**
 * Gets a session by token using a prepared statement.
 * Use this for hot paths like ApiGatewayAuthorizer Lambda.
 * @param token - The session token
 * @returns The session row or null if not found
 */
export async function getSessionByTokenPrepared(token: string): Promise<SessionRow | null> {
  const db = await getDrizzleClient()
  if (!preparedGetSessionByToken) {
    preparedGetSessionByToken = createPreparedGetSessionByToken(db)
  }
  const results = await preparedGetSessionByToken.execute({token})
  return results[0] ?? null
}

/**
 * Resets all prepared statements.
 * Call this after database connection changes (e.g., token refresh).
 * Typically not needed - connection refresh creates new Drizzle client.
 */
export function resetPreparedStatements(): void {
  preparedGetFileByKey = null
  preparedGetUserFiles = null
  preparedGetSessionByToken = null
}
