/**
 * Vitest Global Setup for PostgreSQL Integration Tests
 *
 * Creates worker-specific schemas AND tables before any tests run.
 * Each Vitest worker gets its own schema (worker_1, worker_2, etc.)
 * for complete isolation during parallel test execution.
 *
 * Tables are created here (not in beforeAll) to avoid race conditions
 * when multiple workers start simultaneously.
 *
 * Runs ONCE before all test files, not per-worker.
 */
import postgres from 'postgres'

const MAX_WORKERS = 4

/**
 * Get schema prefix for CI isolation.
 * Uses GITHUB_RUN_ID to ensure parallel CI runs don't interfere.
 */
function getSchemaPrefix(): string {
  const runId = process.env.GITHUB_RUN_ID
  return runId ? `run_${runId}_` : ''
}

/**
 * SQL to create all tables in a schema.
 * Uses TEXT for UUID columns to avoid race conditions with UUID type creation.
 */
function getCreateTablesSql(schema: string): string {
  return `
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
  `
}

/** Creates worker-specific database schemas AND tables before test execution. */
export async function setup(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'
  const prefix = getSchemaPrefix()

  const sql = postgres(databaseUrl)

  try {
    // Create schemas and tables for each worker BEFORE any tests run
    for (let i = 1; i <= MAX_WORKERS; i++) {
      const schemaName = `${prefix}worker_${i}`
      await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`)
      await sql.unsafe(getCreateTablesSql(schemaName))
    }
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
