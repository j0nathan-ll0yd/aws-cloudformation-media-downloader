/**
 * PostgreSQL Test Helpers - Worker-Isolated Version
 *
 * Utilities for setting up and querying test data in PostgreSQL
 * for Drizzle/Aurora DSQL integration tests.
 *
 * Each Jest worker gets its own PostgreSQL schema for complete isolation
 * during parallel test execution. Schema is determined by JEST_WORKER_ID.
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

// Test database connection configuration
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

// Worker-aware connection cache (not singleton - each worker gets its own)
const workerConnections = new Map<string, {db: ReturnType<typeof drizzle>; sqlClient: ReturnType<typeof postgres>}>()

/**
 * Get the current worker's schema name.
 * Uses JEST_WORKER_ID environment variable set by Jest.
 */
function getWorkerSchema(): string {
  const workerId = process.env.JEST_WORKER_ID || '1'
  return `worker_${workerId}`
}

/**
 * Get or create the test database connection for current worker.
 * Each worker has its own connection and operates in its own schema.
 */
export function getTestDb() {
  const schema = getWorkerSchema()

  if (!workerConnections.has(schema)) {
    const sqlClient = postgres(TEST_DATABASE_URL)
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
 * NOTE: Uses TEXT for UUID columns instead of UUID type to avoid race conditions
 * when parallel tests try to create UUID types simultaneously.
 * The Drizzle schema uses UUID, but TEXT works for integration tests.
 */
export async function createAllTables(): Promise<void> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  // Set search_path for this connection to use worker's schema
  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))

  // Create tables in worker schema (parents first)
  // Using TEXT for UUID columns to avoid parallel test race conditions
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS ${schema}.users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      name TEXT,
      image TEXT,
      first_name TEXT,
      last_name TEXT,
      apple_device_id TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${schema}.identity_providers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      email_verified BOOLEAN NOT NULL,
      is_private_email BOOLEAN NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      token_type TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ${schema}.files (
      file_id TEXT PRIMARY KEY,
      size INTEGER NOT NULL DEFAULT 0,
      author_name TEXT NOT NULL,
      author_user TEXT NOT NULL,
      publish_date TEXT NOT NULL,
      description TEXT NOT NULL,
      key TEXT NOT NULL,
      url TEXT,
      content_type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Queued'
    );

    CREATE TABLE IF NOT EXISTS ${schema}.devices (
      device_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      token TEXT NOT NULL,
      system_version TEXT NOT NULL,
      system_name TEXT NOT NULL,
      endpoint_arn TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ${schema}.sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${schema}.accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      access_token_expires_at TIMESTAMP WITH TIME ZONE,
      refresh_token_expires_at TIMESTAMP WITH TIME ZONE,
      scope TEXT,
      id_token TEXT,
      password TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${schema}.verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${schema}.file_downloads (
      file_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'Pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 5,
      retry_after TIMESTAMP WITH TIME ZONE,
      error_category TEXT,
      last_error TEXT,
      scheduled_release_time TIMESTAMP WITH TIME ZONE,
      source_url TEXT,
      correlation_id TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${schema}.user_files (
      user_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, file_id)
    );

    CREATE TABLE IF NOT EXISTS ${schema}.user_devices (
      user_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, device_id)
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS ${schema}_users_email_idx ON ${schema}.users(email);
    CREATE INDEX IF NOT EXISTS ${schema}_users_apple_device_idx ON ${schema}.users(apple_device_id);
    CREATE INDEX IF NOT EXISTS ${schema}_identity_providers_user_idx ON ${schema}.identity_providers(user_id);
    CREATE INDEX IF NOT EXISTS ${schema}_files_key_idx ON ${schema}.files(key);
    CREATE INDEX IF NOT EXISTS ${schema}_file_downloads_status_idx ON ${schema}.file_downloads(status, retry_after);
    CREATE INDEX IF NOT EXISTS ${schema}_sessions_user_idx ON ${schema}.sessions(user_id);
    CREATE INDEX IF NOT EXISTS ${schema}_sessions_token_idx ON ${schema}.sessions(token);
    CREATE INDEX IF NOT EXISTS ${schema}_accounts_user_idx ON ${schema}.accounts(user_id);
    CREATE INDEX IF NOT EXISTS ${schema}_accounts_provider_idx ON ${schema}.accounts(provider_id, account_id);
    CREATE INDEX IF NOT EXISTS ${schema}_verification_identifier_idx ON ${schema}.verification(identifier);
    CREATE INDEX IF NOT EXISTS ${schema}_user_files_user_idx ON ${schema}.user_files(user_id);
    CREATE INDEX IF NOT EXISTS ${schema}_user_files_file_idx ON ${schema}.user_files(file_id);
    CREATE INDEX IF NOT EXISTS ${schema}_user_devices_user_idx ON ${schema}.user_devices(user_id);
    CREATE INDEX IF NOT EXISTS ${schema}_user_devices_device_idx ON ${schema}.user_devices(device_id);
  `))
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

/**
 * Get a session by token from PostgreSQL
 */
export async function getSessionByToken(token: string): Promise<{id: string; userId: string; expiresAt: Date; updatedAt: Date} | null> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))
  const result = await db.execute(sql`SELECT id, user_id, expires_at, updated_at FROM sessions WHERE token = ${token}`)
  const rows = [...result] as Array<{id: string; user_id: string; expires_at: string; updated_at: string}>
  if (rows.length === 0) {
    return null
  }
  const row = rows[0]
  return {id: row.id, userId: row.user_id, expiresAt: new Date(row.expires_at), updatedAt: new Date(row.updated_at)}
}

/**
 * Get a session by ID from PostgreSQL
 */
export async function getSessionById(sessionId: string): Promise<{id: string; userId: string; token: string; expiresAt: Date; updatedAt: Date} | null> {
  const db = getTestDb()
  const schema = getWorkerSchema()

  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))
  const result = await db.execute(sql`SELECT id, user_id, token, expires_at, updated_at FROM sessions WHERE id = ${sessionId}`)
  const rows = [...result] as Array<{id: string; user_id: string; token: string; expires_at: string; updated_at: string}>
  if (rows.length === 0) {
    return null
  }
  const row = rows[0]
  return {id: row.id, userId: row.user_id, token: row.token, expiresAt: new Date(row.expires_at), updatedAt: new Date(row.updated_at)}
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
