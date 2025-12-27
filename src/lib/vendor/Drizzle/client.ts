/**
 * Drizzle ORM Client Wrapper for Aurora DSQL
 *
 * This module provides a connection factory with IAM authentication via SigV4.
 * Domain code should import from this wrapper, not directly from 'drizzle-orm'.
 *
 * Follows the same pattern as AWS SDK encapsulation in lib/vendor/AWS/*.
 *
 * Key features:
 * - IAM authentication via DsqlSigner (no static passwords)
 * - Token refresh before expiration (15 min validity, refresh at 12 min)
 * - Connection caching for Lambda reuse
 * - Public endpoint (no VPC required)
 */
import {DsqlSigner} from '@aws-sdk/dsql-signer'
import {drizzle} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import type {PostgresJsDatabase} from 'drizzle-orm/postgres-js'

import {getOptionalEnv, getRequiredEnv} from '#lib/system/env'
import * as schema from './schema'

let cachedClient: PostgresJsDatabase<typeof schema> | null = null
let cachedSql: ReturnType<typeof postgres> | null = null
let tokenExpiry: number = 0

/**
 * Check if running in test mode with local PostgreSQL.
 */
function isTestMode(): boolean {
  return !!process.env.TEST_DATABASE_URL
}

/**
 * Token refresh buffer in milliseconds.
 * Refresh 3 minutes before expiration (15 min validity).
 */
const TOKEN_REFRESH_BUFFER_MS = 3 * 60 * 1000

/**
 * Token validity period in milliseconds (15 minutes).
 */
const TOKEN_VALIDITY_MS = 15 * 60 * 1000

/**
 * Gets a Drizzle client configured for Aurora DSQL with IAM authentication.
 *
 * This function handles:
 * - Token generation via SigV4 signing
 * - Token refresh before expiration
 * - Connection caching for Lambda warm starts
 *
 * Environment variables required:
 * - DSQL_CLUSTER_ENDPOINT: Aurora DSQL cluster endpoint
 * - DSQL_REGION: AWS region for SigV4 signing (optional, defaults to AWS_REGION)
 *
 * @returns Configured Drizzle client with full schema type inference
 */
export async function getDrizzleClient(): Promise<PostgresJsDatabase<typeof schema>> {
  const now = Date.now()

  if (cachedClient && tokenExpiry > now + TOKEN_REFRESH_BUFFER_MS) {
    return cachedClient
  }

  if (cachedSql) {
    await cachedSql.end()
  }

  // Test mode: use TEST_DATABASE_URL with local PostgreSQL
  if (isTestMode()) {
    cachedSql = postgres(process.env.TEST_DATABASE_URL!, {max: 1, idle_timeout: 20, connect_timeout: 10})
    cachedClient = drizzle(cachedSql, {schema})
    tokenExpiry = now + TOKEN_VALIDITY_MS
    return cachedClient
  }

  // Production mode: use Aurora DSQL with IAM authentication
  const endpoint = getRequiredEnv('DSQL_CLUSTER_ENDPOINT')
  const region = getOptionalEnv('DSQL_REGION', getRequiredEnv('AWS_REGION'))

  const signer = new DsqlSigner({hostname: endpoint, region})
  const token = await signer.getDbConnectAdminAuthToken()

  cachedSql = postgres({
    host: endpoint,
    port: 5432,
    database: 'postgres',
    username: 'admin',
    password: token,
    ssl: 'require',
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10
  })

  cachedClient = drizzle(cachedSql, {schema})
  tokenExpiry = now + TOKEN_VALIDITY_MS

  return cachedClient
}

/**
 * Closes the database connection.
 * Call this during Lambda shutdown or test cleanup.
 */
export async function closeDrizzleClient(): Promise<void> {
  if (cachedSql) {
    await cachedSql.end()
    cachedSql = null
    cachedClient = null
    tokenExpiry = 0
  }
}

/**
 * Re-export drizzle types for use in entity definitions.
 * These are the only drizzle exports allowed in domain code.
 */
export type { PostgresJsDatabase }
