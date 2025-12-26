/**
 * PostgreSQL Test Helpers
 *
 * Utilities for setting up and querying test data in PostgreSQL
 * for Drizzle/Aurora DSQL integration tests.
 *
 * Requires: docker-compose -f docker-compose.test.yml up -d
 */

import {drizzle} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {eq} from 'drizzle-orm'
import {devices, files, userDevices, userFiles, users} from '#lib/vendor/Drizzle/schema'
import type {Device, File, User} from '#types/domain-models'
import {FileStatus} from '#types/enums'
import {createMockDevice, createMockFile, createMockUser} from './test-data'

// Test database connection configuration
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

let testDb: ReturnType<typeof drizzle> | null = null
let testSql: ReturnType<typeof postgres> | null = null

/**
 * Get or create the test database connection
 */
export function getTestDb() {
  if (!testDb) {
    testSql = postgres(TEST_DATABASE_URL)
    testDb = drizzle(testSql)
  }
  return testDb
}

/**
 * Close the test database connection
 */
export async function closeTestDb(): Promise<void> {
  if (testSql) {
    await testSql.end()
    testSql = null
    testDb = null
  }
}

/**
 * Create all tables in the test database
 * Run this in beforeAll() of integration tests
 */
export async function createAllTables(): Promise<void> {
  const db = getTestDb()

  // Create tables in dependency order (parents first)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      email TEXT,
      email_verified BOOLEAN DEFAULT FALSE,
      first_name TEXT,
      last_name TEXT,
      apple_device_id TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS files (
      file_id TEXT PRIMARY KEY,
      size INTEGER,
      author_name TEXT,
      author_user TEXT,
      publish_date TEXT,
      description TEXT,
      key TEXT,
      url TEXT,
      content_type TEXT,
      title TEXT,
      status TEXT DEFAULT 'Queued',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS devices (
      device_id TEXT PRIMARY KEY,
      name TEXT,
      token TEXT,
      system_version TEXT,
      system_name TEXT,
      endpoint_arn TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(user_id),
      expires_at BIGINT,
      token TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS accounts (
      account_id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(user_id),
      provider_id TEXT,
      provider_account_id TEXT,
      access_token TEXT,
      refresh_token TEXT,
      expires_at BIGINT,
      scope TEXT,
      token_type TEXT,
      id_token TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS verification_tokens (
      token TEXT PRIMARY KEY,
      identifier TEXT,
      expires_at BIGINT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS file_downloads (
      file_id TEXT PRIMARY KEY REFERENCES files(file_id),
      status TEXT DEFAULT 'Pending',
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      retry_after BIGINT,
      error_category TEXT,
      last_error TEXT,
      scheduled_release_time BIGINT,
      source_url TEXT,
      correlation_id TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_files (
      user_id TEXT REFERENCES users(user_id),
      file_id TEXT REFERENCES files(file_id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (user_id, file_id)
    );

    CREATE TABLE IF NOT EXISTS user_devices (
      user_id TEXT REFERENCES users(user_id),
      device_id TEXT REFERENCES devices(device_id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (user_id, device_id)
    );

    -- Indexes matching Aurora DSQL requirements
    CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
    CREATE INDEX IF NOT EXISTS users_apple_device_idx ON users(apple_device_id);
    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token);
    CREATE INDEX IF NOT EXISTS accounts_user_idx ON accounts(user_id);
    CREATE INDEX IF NOT EXISTS files_key_idx ON files(key);
    CREATE INDEX IF NOT EXISTS file_downloads_status_idx ON file_downloads(status, retry_after);
    CREATE INDEX IF NOT EXISTS user_files_user_idx ON user_files(user_id);
    CREATE INDEX IF NOT EXISTS user_files_file_idx ON user_files(file_id);
    CREATE INDEX IF NOT EXISTS user_devices_user_idx ON user_devices(user_id);
    CREATE INDEX IF NOT EXISTS user_devices_device_idx ON user_devices(device_id);
  `)
}

/**
 * Drop all tables in the test database
 * Run this in afterAll() of integration tests
 */
export async function dropAllTables(): Promise<void> {
  const db = getTestDb()

  // Drop in reverse dependency order (children first)
  await db.execute(`
    DROP TABLE IF EXISTS user_devices CASCADE;
    DROP TABLE IF EXISTS user_files CASCADE;
    DROP TABLE IF EXISTS file_downloads CASCADE;
    DROP TABLE IF EXISTS verification_tokens CASCADE;
    DROP TABLE IF EXISTS accounts CASCADE;
    DROP TABLE IF EXISTS sessions CASCADE;
    DROP TABLE IF EXISTS devices CASCADE;
    DROP TABLE IF EXISTS files CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  `)
}

/**
 * Truncate all tables (faster than drop/create for between-test cleanup)
 */
export async function truncateAllTables(): Promise<void> {
  const db = getTestDb()

  await db.execute(`
    TRUNCATE user_devices, user_files, file_downloads, verification_tokens,
             accounts, sessions, devices, files, users CASCADE;
  `)
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * Insert a file record into PostgreSQL
 */
export async function insertFile(fileData: Partial<File>): Promise<void> {
  const db = getTestDb()
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
  await db.update(files).set(updates).where(eq(files.fileId, fileId))
}

/**
 * Delete a file record from PostgreSQL
 */
export async function deleteFile(fileId: string): Promise<void> {
  const db = getTestDb()
  await db.delete(files).where(eq(files.fileId, fileId))
}

// ============================================================================
// User Operations
// ============================================================================

/**
 * Insert a user record into PostgreSQL
 */
export async function insertUser(userData: Partial<User> & {appleDeviceId?: string}): Promise<void> {
  const db = getTestDb()
  const defaults = createMockUser(userData)

  await db.insert(users).values({
    userId: defaults.userId!,
    email: defaults.email!,
    emailVerified: defaults.emailVerified ?? false,
    firstName: defaults.firstName!,
    lastName: defaults.lastName,
    appleDeviceId: defaults.appleDeviceId
  })
}

/**
 * Get a user record from PostgreSQL
 */
export async function getUser(userId: string): Promise<Partial<User> | null> {
  const db = getTestDb()
  const result = await db.select().from(users).where(eq(users.userId, userId))
  if (!result[0]) {
    return null
  }

  // Convert null to undefined for optional fields (PostgreSQL returns null, domain uses undefined)
  const row = result[0]
  return {...row, lastName: row.lastName ?? undefined}
}

// ============================================================================
// Device Operations
// ============================================================================

/**
 * Insert a device record into PostgreSQL
 */
export async function insertDevice(deviceData: Partial<Device>): Promise<void> {
  const db = getTestDb()
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
  await db.insert(userFiles).values({userId, fileId})
}

/**
 * Link a user to a device
 */
export async function linkUserDevice(userId: string, deviceId: string): Promise<void> {
  const db = getTestDb()
  await db.insert(userDevices).values({userId, deviceId})
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
