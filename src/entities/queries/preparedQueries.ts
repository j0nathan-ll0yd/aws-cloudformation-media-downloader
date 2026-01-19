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
import {DatabaseOperation, DatabaseTable, RequiresTable} from '../decorators'
import type {FileRow} from './fileQueries'
import type {SessionRow} from './sessionQueries'

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
 * Prepared entity query operations with declarative permission metadata.
 * Each method declares the database permissions it requires via decorators.
 * Permissions are extracted at build time to generate Lambda database roles.
 *
 * Note: These prepared queries have the same permissions as their non-prepared counterparts.
 */
class PreparedQueries {
  /**
   * Gets a file by S3 key using a prepared statement.
   * Use this for hot paths like S3ObjectCreated Lambda.
   * @param key - The S3 object key
   * @returns The file row or null if not found
   */
  @RequiresTable([{table: DatabaseTable.Files, operations: [DatabaseOperation.Select]}])
  static async getFileByKeyPrepared(key: string): Promise<FileRow | null> {
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
  @RequiresTable([
    {table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Select]},
    {table: DatabaseTable.Files, operations: [DatabaseOperation.Select]}
  ])
  static async getUserFilesPrepared(userId: string): Promise<FileRow[]> {
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
  @RequiresTable([{table: DatabaseTable.Sessions, operations: [DatabaseOperation.Select]}])
  static async getSessionByTokenPrepared(token: string): Promise<SessionRow | null> {
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
  static resetPreparedStatements(): void {
    preparedGetFileByKey = null
    preparedGetUserFiles = null
    preparedGetSessionByToken = null
  }
}

// Re-export static methods as named exports for backwards compatibility
export const getFileByKeyPrepared = PreparedQueries.getFileByKeyPrepared.bind(PreparedQueries)
export const getUserFilesPrepared = PreparedQueries.getUserFilesPrepared.bind(PreparedQueries)
export const getSessionByTokenPrepared = PreparedQueries.getSessionByTokenPrepared.bind(PreparedQueries)
export const resetPreparedStatements = PreparedQueries.resetPreparedStatements.bind(PreparedQueries)

// Export class for extraction script access
export { PreparedQueries }
