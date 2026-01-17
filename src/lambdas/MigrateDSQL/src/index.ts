/**
 * MigrateDSQL Lambda
 *
 * Applies database migrations to Aurora DSQL.
 * Invoked by Terraform during deployment after DSQL cluster creation.
 *
 * Features:
 * - Idempotent: Safe to re-run (uses schema_migrations tracking)
 * - Uses same IAM auth as production Lambdas
 * - Reads migrations from bundled SQL files
 * - Supports CREATE INDEX ASYNC for DSQL compatibility
 * - Supports `${VAR_NAME}` substitution for environment variables (e.g., AWS_ACCOUNT_ID)
 *
 * @see docs/wiki/Conventions/Database-Migrations.md
 */
import {readdirSync, readFileSync} from 'fs'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'
import {DatabaseOperation, DatabaseTable} from '#types/databasePermissions'
import {sql} from '#lib/vendor/Drizzle/types'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {addMetadata, endSpan, startSpan} from '#lib/vendor/OpenTelemetry'
import type {MigrationFile, MigrationResult} from '#types/lambda'
import {InvokeHandler, metrics, MetricUnit, RequiresDatabase} from '#lib/lambda/handlers'
import {logDebug, logError, logInfo} from '#lib/system/logging'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Substitutes environment variables in SQL content.
 * Supports `${VAR_NAME}` syntax for variables like AWS_ACCOUNT_ID.
 * @param sqlContent - Raw SQL content with placeholders
 * @returns SQL content with environment variables substituted
 */
function substituteEnvVars(sqlContent: string): string {
  // Match ${VAR_NAME} pattern
  return sqlContent.replace(/\$\{(\w+)\}/g, (_, varName: string) => {
    // Dynamic lookup is intentional - migration files can reference any env var
    // eslint-disable-next-line local-rules/env-validation, local-rules/strict-env-vars
    const value = process.env[varName]
    if (!value) {
      throw new Error(`Environment variable ${varName} is required but not set`)
    }
    return value
  })
}

/**
 * Loads migration files from the migrations directory.
 * Files are sorted by version (filename prefix).
 * @returns Array of migration file objects sorted by version
 */
function loadMigrations(): MigrationFile[] {
  const migrationsDir = join(__dirname, 'migrations')
  logDebug('Loading migrations from', {migrationsDir})

  let files: string[]
  try {
    files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  } catch (error) {
    logError('Failed to read migrations directory', {migrationsDir, error})
    throw new Error(`Failed to read migrations directory: ${migrationsDir}`)
  }

  return files.map((filename) => {
    const filepath = join(migrationsDir, filename)
    const sqlContent = readFileSync(filepath, 'utf-8')

    // Parse version and name from filename: 0001_initial_schema.sql
    const match = filename.match(/^(\d+)_(.+)\.sql$/)
    if (!match) {
      throw new Error(`Invalid migration filename format: ${filename}. Expected: NNNN_name.sql`)
    }

    return {version: match[1], name: match[2], filename, sql: sqlContent}
  })
}

/**
 * Ensures the schema_migrations tracking table exists.
 */
async function ensureMigrationsTable(): Promise<void> {
  const db = await getDrizzleClient()
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `))
}

/**
 * Gets the set of already-applied migration versions.
 * @returns Set of version strings that have been applied
 */
async function getAppliedMigrations(): Promise<Set<string>> {
  const db = await getDrizzleClient()
  const result = await db.execute(sql.raw(`SELECT version FROM schema_migrations`))
  // postgres-js returns RowList which is array-like, cast to array of version objects
  const rows = result as unknown as Array<{version: string}>
  return new Set(rows.map((r) => r.version))
}

/**
 * Splits SQL content into individual statements.
 * Handles comments and multi-line statements correctly.
 * @param sqlContent - Raw SQL content with multiple statements
 * @returns Array of individual SQL statements
 */
function splitStatements(sqlContent: string): string[] {
  // Split on semicolons, filter out empty statements and comment-only lines
  return sqlContent.split(';').map((stmt) => stmt.trim()).filter((stmt) => {
    // Filter out empty statements
    if (!stmt) {
      return false
    }
    const withoutComments = stmt.replace(/--[^\n]*/g, '').trim() // Filter out comment-only statements
    return withoutComments.length > 0
  })
}

/**
 * Error messages that indicate ignorable conditions in migrations.
 * postgres-js wraps errors without exposing the PostgreSQL error code,
 * so we match on the error message text instead.
 */
const IGNORABLE_ERROR_PATTERNS = [
  /already exists/i, // 42710: duplicate_object (role/table/etc already exists)
  /does not exist/i // 42704: undefined_object (for DROP IF EXISTS on non-existent objects)
]

/**
 * Checks if an error is a PostgreSQL error that can be safely ignored.
 * @param error - The error to check
 * @returns true if the error should be ignored
 */
function isIgnorableError(error: unknown): boolean {
  const errorObj = error as {message?: string; cause?: {message?: string}}

  // Check the error message and cause message for ignorable patterns
  const messagesToCheck = [errorObj.message, errorObj.cause?.message].filter(Boolean)

  for (const message of messagesToCheck) {
    for (const pattern of IGNORABLE_ERROR_PATTERNS) {
      if (pattern.test(message as string)) {
        logDebug('Ignoring migration error', {pattern: pattern.source, message})
        return true
      }
    }
  }

  return false
}

/**
 * Applies a single migration and records it.
 * Splits the SQL into individual statements and executes them sequentially.
 * Some PostgreSQL errors (duplicate role, undefined role) are ignored for idempotency.
 * @param migration - The migration file to apply
 */
async function applyMigration(migration: MigrationFile): Promise<void> {
  const db = await getDrizzleClient()

  logInfo('Applying migration', {version: migration.version, name: migration.name})

  // Substitute environment variables (e.g., ${AWS_ACCOUNT_ID})
  const processedSql = substituteEnvVars(migration.sql)

  // Split SQL into individual statements
  const statements = splitStatements(processedSql)
  logDebug('Migration statements', {count: statements.length})

  // Execute each statement sequentially
  for (const statement of statements) {
    logDebug('Executing statement', {statement: statement.substring(0, 100) + '...'})
    try {
      await db.execute(sql.raw(statement))
    } catch (error) {
      if (isIgnorableError(error)) {
        continue
      }
      throw error
    }
  }

  // Record the migration as applied
  await db.execute(sql.raw(`INSERT INTO schema_migrations (version, name) VALUES ('${migration.version}', '${migration.name}')`))

  logInfo('Migration applied successfully', {version: migration.version})
}

/**
 * Handler for database migration invocation.
 * Applies pending migrations from SQL files.
 */
@RequiresDatabase({
  tables: [
    {table: DatabaseTable.Users, operations: [DatabaseOperation.All]},
    {table: DatabaseTable.Files, operations: [DatabaseOperation.All]},
    {table: DatabaseTable.FileDownloads, operations: [DatabaseOperation.All]},
    {table: DatabaseTable.Devices, operations: [DatabaseOperation.All]},
    {table: DatabaseTable.Sessions, operations: [DatabaseOperation.All]},
    {table: DatabaseTable.Accounts, operations: [DatabaseOperation.All]},
    {table: DatabaseTable.VerificationTokens, operations: [DatabaseOperation.All]},
    {table: DatabaseTable.UserFiles, operations: [DatabaseOperation.All]},
    {table: DatabaseTable.UserDevices, operations: [DatabaseOperation.All]}
  ]
})
class MigrateDSQLHandler extends InvokeHandler<{source?: string}, MigrationResult> {
  readonly operationName = 'MigrateDSQL'

  protected async executeInvoke(): Promise<MigrationResult> {
    // Track migration run
    metrics.addMetric('MigrationRun', MetricUnit.Count, 1)

    const span = startSpan('migrate-dsql')

    const result: MigrationResult = {applied: [], skipped: [], errors: []}

    logInfo('MigrateDSQL starting')

    // Ensure migrations tracking table exists
    await ensureMigrationsTable()

    // Load migrations from SQL files
    const migrations = loadMigrations()
    logInfo('Loaded migrations', {count: migrations.length})

    // Get already-applied migrations
    const appliedVersions = await getAppliedMigrations()
    logDebug('Already applied migrations', {versions: [...appliedVersions]})

    // Apply pending migrations in order
    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) {
        result.skipped.push(migration.version)
        logDebug('Migration already applied, skipping', {version: migration.version})
        continue
      }

      try {
        await applyMigration(migration)
        result.applied.push(migration.version)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logError('Migration failed', {version: migration.version, error: message})
        result.errors.push(`${migration.version}: ${message}`)
        // Stop on first error - don't continue with dependent migrations
        break
      }
    }

    // Track successful migrations applied
    if (result.errors.length === 0) {
      metrics.addMetric('MigrationSuccess', MetricUnit.Count, 1)
    }
    addMetadata(span, 'applied', result.applied.length)
    addMetadata(span, 'skipped', result.skipped.length)
    addMetadata(span, 'errors', result.errors.length)
    endSpan(span)

    logInfo('MigrateDSQL completed', result)
    return result
  }
}

const handlerInstance = new MigrateDSQLHandler()
export const handler = handlerInstance.handler.bind(handlerInstance)
