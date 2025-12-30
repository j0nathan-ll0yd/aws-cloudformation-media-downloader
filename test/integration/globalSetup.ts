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
// assigns higher pool IDs (e.g., for the main thread or test shuffling)
const MAX_WORKERS = 8

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
 * - Adds schema prefix to all table names
 * - Converts Aurora DSQL specific syntax for regular PostgreSQL
 * - Converts UUID to TEXT for test simplicity
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

  // Add schema prefix to table references
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
  // - CREATE INDEX ASYNC → CREATE INDEX
  adapted = adapted.replace(/CREATE INDEX ASYNC/g, 'CREATE INDEX')

  // Convert UUID with gen_random_uuid() to TEXT for test simplicity
  // (Tests use crypto.randomUUID() to generate IDs)
  adapted = adapted.replace(/UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/g, 'TEXT PRIMARY KEY')
  adapted = adapted.replace(/UUID NOT NULL/g, 'TEXT NOT NULL')

  return adapted
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

/** Creates worker-specific database schemas AND tables before test execution. */
export async function setup(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'
  const prefix = getSchemaPrefix()

  console.log(`[globalSetup] Starting schema creation with prefix: "${prefix}"`)

  // Read migration files
  const migrationsDir = path.join(process.cwd(), 'migrations')
  const schemaMigration = fs.readFileSync(path.join(migrationsDir, '0001_initial_schema.sql'), 'utf8')
  const indexMigration = fs.readFileSync(path.join(migrationsDir, '0002_create_indexes.sql'), 'utf8')

  const sql = postgres(databaseUrl)

  try {
    // Create schemas and tables for each worker BEFORE any tests run
    for (let i = 1; i <= MAX_WORKERS; i++) {
      const schemaName = `${prefix}worker_${i}`
      console.log(`[globalSetup] Creating schema: ${schemaName}`)

      // Create the schema
      await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`)

      // Adapt and execute schema migration
      const adaptedSchema = adaptMigrationForSchema(schemaMigration, schemaName)
      const schemaStatements = parseSqlStatements(adaptedSchema)
      for (const statement of schemaStatements) {
        await sql.unsafe(statement)
      }

      // Adapt and execute index migration
      const adaptedIndexes = adaptMigrationForSchema(indexMigration, schemaName)
      const indexStatements = parseSqlStatements(adaptedIndexes)
      for (const statement of indexStatements) {
        await sql.unsafe(statement)
      }

      console.log(`[globalSetup] Schema ${schemaName} ready with ${schemaStatements.length} tables`)
    }

    console.log(`[globalSetup] All ${MAX_WORKERS} worker schemas created successfully`)
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

  const sql = postgres(databaseUrl)

  try {
    for (let i = 1; i <= MAX_WORKERS; i++) {
      const schemaName = `${prefix}worker_${i}`
      await sql.unsafe(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`)
    }
  } finally {
    await sql.end()
  }
}
