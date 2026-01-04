/**
 * Test Isolation Validator
 *
 * Validates test isolation to catch data leaks and schema misconfigurations early.
 * Used in setup.ts to ensure tests run in isolated environments.
 */

import {sql} from 'drizzle-orm'
import type {PostgresJsDatabase} from 'drizzle-orm/postgres-js'
import {getWorkerSchema} from './postgres-helpers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDrizzleDb = PostgresJsDatabase<any>

/**
 * Validates that the database connection is using the correct worker schema.
 * Throws an error if schema isolation is broken.
 *
 * @param db - Drizzle database instance
 * @returns The current schema name if validation passes
 * @throws Error if schema doesn't match expected worker schema
 */
export async function validateSchemaIsolation(db: AnyDrizzleDb): Promise<string> {
  const expectedSchema = getWorkerSchema()

  const result = await db.execute(sql`SELECT current_schema()`)
  const currentSchema = result[0]?.current_schema as string | undefined

  if (!currentSchema || currentSchema !== expectedSchema) {
    throw new Error(
      `[ISOLATION ERROR] Schema mismatch: expected '${expectedSchema}', got '${currentSchema ?? 'undefined'}'. ` +
        'This indicates a test isolation failure - tests may be sharing data.'
    )
  }

  return currentSchema
}

/**
 * Validates that key tables are empty (useful after truncation).
 * Logs warnings if residual data is found.
 *
 * @param db - Drizzle database instance
 * @param schema - Schema name to check
 * @returns Object with table counts
 */
export async function validateCleanState(db: AnyDrizzleDb, schema: string): Promise<Record<string, number>> {
  const tables = ['users', 'files', 'devices', 'sessions', 'accounts', 'user_files', 'user_devices', 'file_downloads', 'verification_token']

  const counts: Record<string, number> = {}
  const warnings: string[] = []

  for (const table of tables) {
    try {
      const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${schema}"."${table}"`))
      const count = Number(result[0]?.count ?? 0)
      counts[table] = count

      if (count > 0) {
        warnings.push(`${table}: ${count} rows`)
      }
    } catch {
      // Table might not exist in schema
      counts[table] = -1
    }
  }

  if (warnings.length > 0 && process.env.LOG_LEVEL !== 'SILENT') {
    console.warn(`[ISOLATION WARNING] Residual data found in ${schema}:`, warnings.join(', '))
  }

  return counts
}

/**
 * Validates AWS resource naming includes worker isolation prefix.
 * Logs a warning if resources might not be properly isolated.
 *
 * @param resourceName - Name of the AWS resource (queue, bus, etc.)
 * @param resourceType - Type of resource for error messages
 */
export function validateResourceIsolation(resourceName: string, resourceType: string): void {
  const workerId = process.env.VITEST_POOL_ID || '1'
  const runId = process.env.GITHUB_RUN_ID

  // In CI, should include run ID prefix
  if (runId && !resourceName.includes(runId)) {
    console.warn(
      `[ISOLATION WARNING] ${resourceType} '${resourceName}' does not include CI run ID '${runId}'. ` + 'This may cause conflicts with parallel CI runs.'
    )
  }

  // Should always include worker ID
  if (!resourceName.includes(`w${workerId}`) && !resourceName.includes(`worker${workerId}`)) {
    console.warn(
      `[ISOLATION WARNING] ${resourceType} '${resourceName}' may not include worker ID '${workerId}'. ` +
        'This may cause conflicts with parallel test workers.'
    )
  }
}

/**
 * Logs isolation configuration for debugging CI issues.
 * Only outputs when LOG_LEVEL is not SILENT.
 */
export function logIsolationConfig(): void {
  if (process.env.LOG_LEVEL === 'SILENT') {
    return
  }

  const config = {
    workerId: process.env.VITEST_POOL_ID || '1',
    runId: process.env.GITHUB_RUN_ID || 'local',
    schema: getWorkerSchema(),
    isCI: process.env.CI === 'true'
  }

  console.log('[isolation-validator] Configuration:', JSON.stringify(config, null, 2))
}
