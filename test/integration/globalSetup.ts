/**
 * Vitest Global Setup for PostgreSQL Integration Tests
 *
 * Creates worker-specific schemas AND tables before any tests run.
 * Each Vitest worker gets its own schema (worker_1, worker_2, etc.)
 * for complete isolation during parallel test execution.
 *
 * Tables are created by reading from the canonical migration files
 * and adapting them for test schemas.
 *
 * Runs ONCE before all test files, not per-worker.
 */
import * as fs from 'fs'
import * as path from 'path'
import postgres from 'postgres'

// Create more schemas than maxWorkers to handle edge cases where Vitest
// assigns higher pool IDs (e.g., for the main thread, test shuffling, or
// internal coordination threads). Vitest may use pool IDs beyond maxWorkers.
// Set to 20 to safely cover all possible pool IDs with margin.
const MAX_WORKERS = 20

/**
 * Get schema prefix for CI isolation.
 * Uses GITHUB_RUN_ID to ensure parallel CI runs don't interfere.
 */
function getSchemaPrefix(): string {
  const runId = process.env.GITHUB_RUN_ID
  return runId ? `run_${runId}_` : ''
}

/**
 * Read and adapt migration SQL for a specific schema.
 *
 * CONVENTION: Migrations are the single source of truth for SQL.
 * This function only applies minimal transformations needed for test environment:
 * - Schema prefix for worker isolation (parallel test execution)
 * - Aurora DSQL → PostgreSQL syntax (CREATE INDEX ASYNC → CREATE INDEX)
 * - UUID → TEXT for test simplicity with regular PostgreSQL
 *
 * DO NOT add DEFAULT NULL or other schema modifications here.
 * All schema definitions belong in migrations/0001_initial_schema.sql.
 */
function adaptMigrationForSchema(migrationSql: string, schema: string): string {
  let adapted = migrationSql

  // List of tables to prefix with schema
  const tables = [
    'schema_migrations',
    'users',
    'sessions',
    'accounts',
    'verification',
    'identity_providers',
    'files',
    'file_downloads',
    'devices',
    'user_files',
    'user_devices'
  ]

  // Add schema prefix to table references (for worker isolation)
  for (const table of tables) {
    // Match table name in CREATE TABLE, CREATE INDEX, ON clauses
    // Use word boundaries to avoid partial matches
    const patterns = [
      new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`, 'g'),
      new RegExp(`ON ${table}\\(`, 'g'),
      new RegExp(`ON ${table} `, 'g')
    ]

    adapted = adapted.replace(patterns[0], `CREATE TABLE IF NOT EXISTS ${schema}.${table}`)
    adapted = adapted.replace(patterns[1], `ON ${schema}.${table}(`)
    adapted = adapted.replace(patterns[2], `ON ${schema}.${table} `)
  }

  // Convert Aurora DSQL specific syntax for regular PostgreSQL:
  // - CREATE INDEX ASYNC → CREATE INDEX (Aurora DSQL uses async index creation)
  adapted = adapted.replace(/CREATE INDEX ASYNC/g, 'CREATE INDEX')

  // Convert UUID to TEXT for test simplicity with regular PostgreSQL
  // Better Auth uses `generateId: false` which sends DEFAULT for id columns
  adapted = adapted.replace(/UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/g, 'TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text')
  adapted = adapted.replace(/UUID NOT NULL/g, 'TEXT NOT NULL')

  return adapted
}

/**
 * Validate that Aurora DSQL-specific syntax has been properly adapted.
 * Throws an error if unadapted features are detected.
 *
 * @param adapted - The adapted SQL string
 * @throws Error if unadapted Aurora DSQL features are found
 */
function validateAdaptations(adapted: string): void {
  const issues: string[] = []

  // Check for unadapted Aurora DSQL features
  if (adapted.includes('CREATE INDEX ASYNC')) {
    issues.push('CREATE INDEX ASYNC not converted to CREATE INDEX')
  }

  if (adapted.includes('TIMESTAMP WITHOUT TIME ZONE')) {
    issues.push('TIMESTAMP WITHOUT TIME ZONE found - may cause timezone issues')
  }

  // Warn (but don't fail) for UUID columns that might need attention
  // Note: Some UUIDs are intentionally kept for specific use cases
  if (adapted.match(/UUID\s+(NOT NULL|REFERENCES)/)) {
    log('[globalSetup] INFO: UUID columns found in adapted schema - ensure test compatibility')
  }

  if (issues.length > 0) {
    throw new Error(`Aurora DSQL adaptation issues detected:\n${issues.map((i) => `  - ${i}`).join('\n')}`)
  }
}

/**
 * Parse SQL file into individual statements.
 * Handles multi-line statements and comments.
 */
function parseSqlStatements(sql: string): string[] {
  // Remove SQL comments
  const noComments = sql.replace(/--.*$/gm, '')

  // Split by semicolons, filter empty statements
  return noComments.split(';').map((s) => s.trim()).filter((s) => s.length > 0)
}

/** Log helper that respects LOG_LEVEL=SILENT */
function log(message: string): void {
  if (process.env.LOG_LEVEL !== 'SILENT') {
    console.log(message)
  }
}

/** Sleep helper for retry logic */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wait for PostgreSQL to be ready with retry logic.
 * This handles cases where PostgreSQL is still starting up in CI.
 */
async function waitForPostgres(databaseUrl: string, maxRetries = 30, retryDelayMs = 1000): Promise<postgres.Sql> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const sql = postgres(databaseUrl, {onnotice: () => {}})
      // Test the connection with a simple query
      await sql`SELECT 1`
      log(`[globalSetup] PostgreSQL connection established on attempt ${attempt}`)
      return sql
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries) {
        log(`[globalSetup] PostgreSQL not ready (attempt ${attempt}/${maxRetries}), retrying in ${retryDelayMs}ms...`)
        await sleep(retryDelayMs)
      }
    }
  }

  throw new Error(`Failed to connect to PostgreSQL after ${maxRetries} attempts: ${lastError?.message}`)
}

/** Creates worker-specific database schemas AND tables before test execution. */
export async function setup(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'
  const prefix = getSchemaPrefix()

  log(`[globalSetup] Starting schema creation with prefix: "${prefix}"`)
  log(`[globalSetup] MAX_WORKERS: ${MAX_WORKERS}`)

  // Read migration files
  const migrationsDir = path.join(process.cwd(), 'migrations')
  const schemaMigration = fs.readFileSync(path.join(migrationsDir, '0001_initial_schema.sql'), 'utf8')
  const indexMigration = fs.readFileSync(path.join(migrationsDir, '0002_create_indexes.sql'), 'utf8')

  // Wait for PostgreSQL to be ready with retry logic (handles CI startup delays)
  const sql = await waitForPostgres(databaseUrl)

  try {
    // Create schemas and tables for each worker BEFORE any tests run
    // Use parallel creation for faster setup (reduces flaky test failures)
    const createSchema = async (workerId: number) => {
      const schemaName = `${prefix}worker_${workerId}`
      log(`[globalSetup] Creating schema: ${schemaName}`)

      // Create the schema
      await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`)

      // Adapt and execute schema migration
      const adaptedSchema = adaptMigrationForSchema(schemaMigration, schemaName)
      validateAdaptations(adaptedSchema)
      const schemaStatements = parseSqlStatements(adaptedSchema)
      for (const statement of schemaStatements) {
        await sql.unsafe(statement)
      }

      // Adapt and execute index migration
      const adaptedIndexes = adaptMigrationForSchema(indexMigration, schemaName)
      validateAdaptations(adaptedIndexes)
      const indexStatements = parseSqlStatements(adaptedIndexes)
      for (const statement of indexStatements) {
        await sql.unsafe(statement)
      }

      log(`[globalSetup] Schema ${schemaName} ready with ${schemaStatements.length} tables`)
    }

    // Create all schemas in parallel for faster setup
    // This ensures all schemas are ready before any tests start
    const workerIds = Array.from({length: MAX_WORKERS}, (_, i) => i + 1)
    await Promise.all(workerIds.map(createSchema))

    log(`[globalSetup] All ${MAX_WORKERS} worker schemas created successfully`)
  } catch (error) {
    console.error('[globalSetup] ERROR creating schemas:', error)
    throw error
  } finally {
    await sql.end()
  }
}

/** Drops all worker schemas after test execution completes. */
export async function teardown(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'
  const prefix = getSchemaPrefix()

  // Suppress PostgreSQL NOTICE messages during cleanup
  const sql = postgres(databaseUrl, {onnotice: () => {}})

  try {
    for (let i = 1; i <= MAX_WORKERS; i++) {
      const schemaName = `${prefix}worker_${i}`
      await sql.unsafe(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`)
    }
  } finally {
    await sql.end()
  }
}
