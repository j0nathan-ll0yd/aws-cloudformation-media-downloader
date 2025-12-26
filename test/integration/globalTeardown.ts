/**
 * Jest Global Teardown for PostgreSQL Integration Tests
 *
 * Drops all worker schemas after all tests complete.
 * Cleans up the database for the next test run.
 *
 * Runs ONCE after all test files complete.
 */
import postgres from 'postgres'

const MAX_WORKERS = 4

export default async function globalTeardown(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

  const sql = postgres(databaseUrl)

  try {
    // Drop schemas for each worker
    for (let i = 1; i <= MAX_WORKERS; i++) {
      const schemaName = `worker_${i}`
      await sql.unsafe(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`)
    }
  } finally {
    await sql.end()
  }
}
