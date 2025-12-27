/**
 * Vitest Global Setup for PostgreSQL Integration Tests
 *
 * Creates worker-specific schemas before any tests run.
 * Each Vitest worker gets its own schema (worker_1, worker_2, etc.)
 * for complete isolation during parallel test execution.
 *
 * Runs ONCE before all test files, not per-worker.
 */
import postgres from 'postgres'

const MAX_WORKERS = 4

/** Creates worker-specific database schemas before test execution. */
export async function setup(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

  const sql = postgres(databaseUrl)

  try {
    for (let i = 1; i <= MAX_WORKERS; i++) {
      const schemaName = `worker_${i}`
      await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`)
    }
  } finally {
    await sql.end()
  }
}

/** Drops all worker schemas after test execution completes. */
export async function teardown(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

  const sql = postgres(databaseUrl)

  try {
    for (let i = 1; i <= MAX_WORKERS; i++) {
      const schemaName = `worker_${i}`
      await sql.unsafe(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`)
    }
  } finally {
    await sql.end()
  }
}
