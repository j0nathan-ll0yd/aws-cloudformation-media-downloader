/**
 * PostgreSQL Test Helpers - Worker-Isolated Version
 *
 * Utilities for setting up and querying test data in PostgreSQL
 * for Drizzle/Aurora DSQL integration tests.
 *
 * Each Vitest worker gets its own PostgreSQL schema for complete isolation
 * during parallel test execution. Schema is determined by VITEST_POOL_ID.
 *
 * Requires: docker-compose -f docker-compose.test.yml up -d
 */

import {drizzle} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {eq, sql} from 'drizzle-orm'
import {devices, files, userDevices, userFiles, users} from '#lib/vendor/Drizzle/schema'
import type {Device, File, User} from '#types/domain-models'
import {FileStatus} from '#types/enums'
import {createMockDevice, createMockFile, createMockUser} from './test-data'
import * as fs from 'fs'
import * as path from 'path'

// Test database connection configuration
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

// Worker-aware connection cache (not singleton - each worker gets its own)
const workerConnections = new Map<string, {db: ReturnType<typeof drizzle>; sqlClient: ReturnType<typeof postgres>}>()

// Path to migrations directory (relative to project root)
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations')

/**
 * Read migration SQL files and prepare for test environment.
 * Migrations are the source of truth - only minimal changes for test compatibility:
 * - Adds schema qualification for worker isolation
 * - Removes ASYNC keyword (Aurora DSQL specific, not supported in regular PostgreSQL)
 */
function getMigrationSQL(schema: string): string {
  const schemaSQL = fs.readFileSync(path.join(MIGRATIONS_DIR, '0001_initial_schema.sql'), 'utf-8')
  const indexSQL = fs.readFileSync(path.join(MIGRATIONS_DIR, '0002_create_indexes.sql'), 'utf-8')

  let sql = schemaSQL + '\n' + indexSQL

  // Remove ASYNC keyword (Aurora DSQL specific, regular PostgreSQL doesn't support it)
  sql = sql.replace(/CREATE INDEX ASYNC/g, 'CREATE INDEX')

  // Add schema qualification for worker isolation
  sql = sql.replace(/CREATE TABLE IF NOT EXISTS /g, `CREATE TABLE IF NOT EXISTS ${schema}.`)
  sql = sql.replace(/CREATE INDEX IF NOT EXISTS /g, `CREATE INDEX IF NOT EXISTS ${schema}_`)
  sql = sql.replace(/ ON ([a-z_]+)\(/g, ` ON ${schema}.$1(`)

  return sql
}

/**
 * Get the current worker's schema name.
 * Vitest uses VITEST_POOL_ID for thread pools.
 */
function getWorkerSchema(): string {
  const workerId = process.env.VITEST_POOL_ID || '1'
  return `worker_${workerId}`
}

/**
 * Get or create the test database connection for current worker.
 * Each worker has its own connection and operates in its own schema.
 * Uses max: 1 to ensure search_path persists on the same connection.
 */
export function getTestDb() {
  const schema = getWorkerSchema()

  if (!workerConnections.has(schema)) {
    // Force single connection per worker so search_path persists across queries
    const sqlClient = postgres(TEST_DATABASE_URL, {
      max: 1,
      onnotice: () => {} // Suppress NOTICE messages
    })
    const db = drizzle(sqlClient)
    workerConnections.set(schema, {db, sqlClient})
  }

  return workerConnections.get(schema)!.db
}

/**
 * Close the test database connection for current worker
 */
export async function closeTestDb(): Promise<void> {
  const schema = getWorkerSchema()
  const conn = workerConnections.get(schema)

  if (conn) {
    await conn.sqlClient.end()
    workerConnections.delete(schema)
  }
}

/**
 * Create all tables in the worker's schema.
 * Run this in beforeAll() of integration tests.
 *
 * Uses migration files as the source of truth with minimal transformations:
 * - Removes ASYNC keyword (Aurora DSQL specific, not supported in PostgreSQL)
 * - Adds schema qualification for worker isolation
 */
export async function createAllTables(): Promise<void> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  // Set search_path for this connection to use worker's schema
  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))

  // Create tables using migration files as source of truth
  await db.execute(sql.raw(getMigrationSQL(schema)))
}

/**
 * Drop all tables from worker's schema.
 * Run this in afterAll() of integration tests.
 */
export async function dropAllTables(): Promise<void> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  // Drop in reverse dependency order (children first)
  await db.execute(sql.raw(`
    DROP TABLE IF EXISTS ${schema}.user_devices CASCADE;
    DROP TABLE IF EXISTS ${schema}.user_files CASCADE;
    DROP TABLE IF EXISTS ${schema}.file_downloads CASCADE;
    DROP TABLE IF EXISTS ${schema}.verification CASCADE;
    DROP TABLE IF EXISTS ${schema}.accounts CASCADE;
    DROP TABLE IF EXISTS ${schema}.sessions CASCADE;
    DROP TABLE IF EXISTS ${schema}.identity_providers CASCADE;
    DROP TABLE IF EXISTS ${schema}.devices CASCADE;
    DROP TABLE IF EXISTS ${schema}.files CASCADE;
    DROP TABLE IF EXISTS ${schema}.users CASCADE;
  `))
}

/**
 * Truncate all tables (faster than drop/create for between-test cleanup)
 */
export async function truncateAllTables(): Promise<void> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  await db.execute(sql.raw(`
    TRUNCATE ${schema}.user_devices, ${schema}.user_files, ${schema}.file_downloads,
             ${schema}.verification, ${schema}.accounts, ${schema}.sessions,
             ${schema}.identity_providers, ${schema}.devices, ${schema}.files, ${schema}.users
    CASCADE;
  `))
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * Insert a file record into PostgreSQL
 */
export async function insertFile(fileData: Partial<File>): Promise<void> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  // Set search_path for this query
  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))

  const defaults = createMockFile(fileData.fileId!, fileData.status || FileStatus.Queued, fileData)

  await db.insert(files).values({
    fileId: defaults.fileId!,
    status: defaults.status!,
    size: defaults.size!,
    key: defaults.key!,
    title: defaults.title!,
    description: defaults.description!,
    authorName: defaults.authorName!,
    authorUser: defaults.authorUser!,
    publishDate: defaults.publishDate!,
    contentType: defaults.contentType!,
    url: defaults.url
  })
}

/**
 * Get a file record from PostgreSQL
 */
export async function getFile(fileId: string): Promise<Partial<File> | null> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  // Set search_path for this query
  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))

  const result = await db.select().from(files).where(eq(files.fileId, fileId))
  if (!result[0]) {
    return null
  }

  // Convert null to undefined for optional fields and cast status to enum
  const row = result[0]
  return {...row, url: row.url ?? undefined, status: row.status as FileStatus}
}

/**
 * Update a file record in PostgreSQL
 */
export async function updateFile(fileId: string, updates: Partial<File>): Promise<void> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))
  await db.update(files).set(updates).where(eq(files.fileId, fileId))
}

/**
 * Delete a file record from PostgreSQL
 */
export async function deleteFile(fileId: string): Promise<void> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))
  await db.delete(files).where(eq(files.fileId, fileId))
}

// ============================================================================
// User Operations
// ============================================================================

/**
 * Insert a user record into PostgreSQL
 * Accepts either 'id' (domain type) or 'userId' (legacy tests) for backwards compatibility
 */
export async function insertUser(userData: Partial<User> & {appleDeviceId?: string; userId?: string}): Promise<void> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))

  const defaults = createMockUser(userData)

  await db.insert(users).values({
    id: defaults.id!,
    email: defaults.email!,
    emailVerified: defaults.emailVerified ?? false,
    name: defaults.name,
    firstName: defaults.firstName,
    lastName: defaults.lastName,
    appleDeviceId: defaults.appleDeviceId
  })
}

/**
 * Get a user record from PostgreSQL
 */
export async function getUser(id: string): Promise<Partial<User> | null> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))

  const result = await db.select().from(users).where(eq(users.id, id))
  if (!result[0]) {
    return null
  }

  // Convert null to undefined for optional fields (PostgreSQL returns null, domain uses undefined)
  const row = result[0]
  return {
    id: row.id,
    email: row.email,
    emailVerified: row.emailVerified,
    name: row.name ?? undefined,
    firstName: row.firstName ?? undefined,
    lastName: row.lastName ?? undefined
  }
}

// ============================================================================
// Device Operations
// ============================================================================

/**
 * Insert a device record into PostgreSQL
 */
export async function insertDevice(deviceData: Partial<Device>): Promise<void> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))

  const defaults = createMockDevice(deviceData)

  await db.insert(devices).values({
    deviceId: defaults.deviceId!,
    name: defaults.name!,
    token: defaults.token!,
    systemVersion: defaults.systemVersion!,
    systemName: defaults.systemName!,
    endpointArn: defaults.endpointArn!
  })
}

/**
 * Get a device record from PostgreSQL
 */
export async function getDevice(deviceId: string): Promise<Partial<Device> | null> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))

  const result = await db.select().from(devices).where(eq(devices.deviceId, deviceId))
  return result[0] || null
}

// ============================================================================
// Junction Table Operations
// ============================================================================

/**
 * Link a user to a file
 */
export async function linkUserFile(userId: string, fileId: string): Promise<void> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))
  await db.insert(userFiles).values({userId, fileId})
}

/**
 * Link a user to a device
 */
export async function linkUserDevice(userId: string, deviceId: string): Promise<void> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))
  await db.insert(userDevices).values({userId, deviceId})
}

// ============================================================================
// FileDownloads Operations
// ============================================================================

/**
 * Insert a file download record into PostgreSQL
 */
export async function insertFileDownload(
  data: {
    fileId: string
    status: string
    updatedAt?: Date
    createdAt?: Date
    retryCount?: number
    maxRetries?: number
    sourceUrl?: string
    correlationId?: string
  }
): Promise<void> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))

  const now = new Date().toISOString()
  await db.execute(sql`
    INSERT INTO file_downloads (file_id, status, retry_count, max_retries, source_url, correlation_id, created_at, updated_at)
    VALUES (${data.fileId}, ${data.status}, ${data.retryCount ?? 0}, ${data.maxRetries ?? 5},
            ${data.sourceUrl ?? null}, ${data.correlationId ?? null},
            ${data.createdAt?.toISOString() ?? now}, ${data.updatedAt?.toISOString() ?? now})
  `)
}

/**
 * Get all file downloads from PostgreSQL
 */
export async function getFileDownloads(): Promise<Array<{fileId: string; status: string}>> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))
  const result = await db.execute(sql`SELECT file_id, status FROM file_downloads`)
  const rows = [...result] as Array<{file_id: string; status: string}>
  return rows.map((row) => ({fileId: row.file_id, status: row.status}))
}

// ============================================================================
// Sessions Operations
// ============================================================================

/**
 * Insert a session record into PostgreSQL
 */
export async function insertSession(data: {id?: string; userId: string; token: string; expiresAt: Date; createdAt?: Date; updatedAt?: Date}): Promise<void> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))

  const now = new Date().toISOString()
  const id = data.id ?? crypto.randomUUID()
  await db.execute(sql`
    INSERT INTO sessions (id, user_id, token, expires_at, created_at, updated_at)
    VALUES (${id}, ${data.userId}, ${data.token}, ${data.expiresAt.toISOString()}, ${data.createdAt?.toISOString() ?? now}, ${
    data.updatedAt?.toISOString() ?? now
  })
  `)
}

/**
 * Get all sessions from PostgreSQL
 */
export async function getSessions(): Promise<Array<{id: string; userId: string}>> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))
  const result = await db.execute(sql`SELECT id, user_id FROM sessions`)
  const rows = [...result] as Array<{id: string; user_id: string}>
  return rows.map((row) => ({id: row.id, userId: row.user_id}))
}

// ============================================================================
// Verification Operations
// ============================================================================

/**
 * Insert a verification token record into PostgreSQL
 */
export async function insertVerification(
  data: {id?: string; identifier: string; value: string; expiresAt: Date; createdAt?: Date; updatedAt?: Date}
): Promise<void> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))

  const now = new Date().toISOString()
  const id = data.id ?? crypto.randomUUID()
  await db.execute(sql`
    INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at)
    VALUES (${id}, ${data.identifier}, ${data.value}, ${data.expiresAt.toISOString()}, ${data.createdAt?.toISOString() ?? now}, ${
    data.updatedAt?.toISOString() ?? now
  })
  `)
}

/**
 * Get all verification tokens from PostgreSQL
 */
export async function getVerificationTokens(): Promise<Array<{id: string; identifier: string}>> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))
  const result = await db.execute(sql`SELECT id, identifier FROM verification`)
  const rows = [...result] as Array<{id: string; identifier: string}>
  return rows.map((row) => ({id: row.id, identifier: row.identifier}))
}

// ============================================================================
// Legacy Aliases (for backward compatibility with DynamoDB tests)
// ============================================================================

/** @deprecated Use createAllTables instead */
export const createFilesTable = createAllTables
/** @deprecated Use createAllTables instead */
export const createUsersTable = createAllTables
/** @deprecated Use createAllTables instead */
export const createUserFilesTable = createAllTables
/** @deprecated Use createAllTables instead */
export const createMediaDownloaderTable = createAllTables
/** @deprecated Use createAllTables instead */
export const createIdempotencyTable = createAllTables

/** @deprecated Use dropAllTables instead */
export const deleteFilesTable = dropAllTables
/** @deprecated Use dropAllTables instead */
export const deleteUsersTable = dropAllTables
/** @deprecated Use dropAllTables instead */
export const deleteUserFilesTable = dropAllTables
/** @deprecated Use dropAllTables instead */
export const deleteMediaDownloaderTable = dropAllTables
/** @deprecated Use dropAllTables instead */
export const deleteIdempotencyTable = dropAllTables
