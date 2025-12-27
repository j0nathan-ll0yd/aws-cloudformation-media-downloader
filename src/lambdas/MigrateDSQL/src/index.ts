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
 *
 * @see docs/wiki/Conventions/Database-Migrations.md
 */
import {readdirSync, readFileSync} from 'fs'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'
import {sql} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapLambdaInvokeHandler} from '#lib/lambda/middleware/internal'
import {logDebug, logError, logInfo} from '#lib/system/logging'
import type {MigrationResult} from '#types/lambda'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface MigrationFile {
  version: string
  name: string
  filename: string
  sql: string
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
    // Filter out comment-only statements
    const withoutComments = stmt.replace(/--[^\n]*/g, '').trim()
    return withoutComments.length > 0
  })
}

/**
 * Applies a single migration and records it.
 * Splits the SQL into individual statements and executes them sequentially.
 * @param migration - The migration file to apply
 */
async function applyMigration(migration: MigrationFile): Promise<void> {
  const db = await getDrizzleClient()

  logInfo('Applying migration', {version: migration.version, name: migration.name})

  // Split SQL into individual statements
  const statements = splitStatements(migration.sql)
  logDebug('Migration statements', {count: statements.length})

  // Execute each statement sequentially
  for (const statement of statements) {
    logDebug('Executing statement', {statement: statement.substring(0, 100) + '...'})
    await db.execute(sql.raw(statement))
  }

  // Record the migration as applied
  await db.execute(sql.raw(`INSERT INTO schema_migrations (version, name) VALUES ('${migration.version}', '${migration.name}')`))

  logInfo('Migration applied successfully', {version: migration.version})
}

/**
 * Lambda handler that applies pending database migrations.
 *
 * Invoked by Terraform during deployment. Safe to re-run - skips
 * already-applied migrations.
 *
 * @returns MigrationResult with lists of applied, skipped, and errored migrations
 */
export const handler = withPowertools(wrapLambdaInvokeHandler<{source?: string}, MigrationResult>(async (): Promise<MigrationResult> => {
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

  logInfo('MigrateDSQL completed', result)
  return result
}))
