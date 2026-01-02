/**
 * Vitest Global Teardown for PostgreSQL Integration Tests
 *
 * Drops all worker schemas after all tests complete.
 * Cleans up the database and AWS SDK clients for the next test run.
 *
 * Runs ONCE after all test files complete.
 */
import postgres from 'postgres'
import {destroyAllClients} from './helpers/aws-client-cleanup'

// Must match MAX_WORKERS in globalSetup.ts
const MAX_WORKERS = 8

/**
 * Get schema prefix for CI isolation.
 * Uses GITHUB_RUN_ID to ensure parallel CI runs don't interfere.
 */
function getSchemaPrefix(): string {
  const runId = process.env.GITHUB_RUN_ID
  return runId ? `run_${runId}_` : ''
}

/** Cleans up worker schemas after all integration tests complete. */
export default async function globalTeardown() {
  const databaseUrl = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'
  const prefix = getSchemaPrefix()

  const sql = postgres(databaseUrl)

  try {
    // Drop schemas for each worker
    for (let i = 1; i <= MAX_WORKERS; i++) {
      const schemaName = `${prefix}worker_${i}`
      await sql.unsafe(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`)
    }
  } finally {
    await sql.end()
  }

  // Destroy AWS SDK clients to release HTTP connections
  await destroyAllClients()
}
