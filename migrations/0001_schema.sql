-- Migration: 0001_schema
-- Description: Initial database schema for Aurora DSQL with Better Auth
-- Created: 2025-12-26
-- Updated: 2026-01-16 (consolidated schema + indexes)
--
-- Schema aligned with Better Auth official drizzle adapter expectations:
-- - Primary keys: 'id' (UUID with database-generated values)
-- - Timestamps: TIMESTAMP WITH TIME ZONE
-- - Table names: users, sessions, accounts, verification
-- - Better Auth configured with generateId: false to let DB generate UUIDs

-- =============================================================================
-- SCHEMA MIGRATIONS TRACKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- BETTER AUTH CORE TABLES
-- =============================================================================

-- Users table - Better Auth core table
-- NOTE: Nullable columns use DEFAULT NULL for Better Auth compatibility
-- (Better Auth sends DEFAULT in INSERT for columns without values)
-- NOTE: apple_device_id was removed from schema (unused, architectural mismatch)
-- but Aurora DSQL doesn't support ALTER TABLE DROP COLUMN, so existing
-- databases may still have this column. It's harmless as nullable/unused.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  name TEXT DEFAULT NULL,
  image TEXT DEFAULT NULL,
  first_name TEXT DEFAULT NULL,
  last_name TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Sessions table - Better Auth sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Accounts table - Better Auth OAuth accounts
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  access_token TEXT DEFAULT NULL,
  refresh_token TEXT DEFAULT NULL,
  access_token_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  refresh_token_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  scope TEXT DEFAULT NULL,
  id_token TEXT DEFAULT NULL,
  password TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Verification table - Better Auth verification tokens
CREATE TABLE IF NOT EXISTS verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- APPLICATION TABLES
-- =============================================================================

-- Files table - Video metadata storage
CREATE TABLE IF NOT EXISTS files (
  file_id TEXT PRIMARY KEY,
  size INTEGER NOT NULL DEFAULT 0,
  author_name TEXT NOT NULL,
  author_user TEXT NOT NULL,
  publish_date TEXT NOT NULL,
  description TEXT NOT NULL,
  key TEXT NOT NULL,
  url TEXT DEFAULT NULL,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Queued'
);

-- File Downloads table - Download orchestration state
CREATE TABLE IF NOT EXISTS file_downloads (
  file_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'Pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  retry_after TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  error_category TEXT DEFAULT NULL,
  last_error TEXT DEFAULT NULL,
  scheduled_release_time TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  source_url TEXT DEFAULT NULL,
  correlation_id TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Devices table - iOS device registration
CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token TEXT NOT NULL,
  system_version TEXT NOT NULL,
  system_name TEXT NOT NULL,
  endpoint_arn TEXT NOT NULL
);

-- =============================================================================
-- RELATIONSHIP TABLES (Many-to-Many)
-- =============================================================================

-- User Files table - Many-to-many
CREATE TABLE IF NOT EXISTS user_files (
  user_id UUID NOT NULL,
  file_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, file_id)
);

-- User Devices table - Many-to-many
CREATE TABLE IF NOT EXISTS user_devices (
  user_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, device_id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================
-- Aurora DSQL requires CREATE INDEX ASYNC for non-blocking index creation.
-- All indexes use IF NOT EXISTS for idempotency.

-- Users table indexes
CREATE INDEX ASYNC IF NOT EXISTS users_email_idx ON users(email);

-- Files table indexes
CREATE INDEX ASYNC IF NOT EXISTS files_key_idx ON files(key);

-- File Downloads table indexes
CREATE INDEX ASYNC IF NOT EXISTS file_downloads_status_idx ON file_downloads(status, retry_after);

-- Sessions table indexes
CREATE INDEX ASYNC IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX ASYNC IF NOT EXISTS sessions_token_idx ON sessions(token);

-- Accounts table indexes
CREATE INDEX ASYNC IF NOT EXISTS accounts_user_idx ON accounts(user_id);
CREATE INDEX ASYNC IF NOT EXISTS accounts_provider_idx ON accounts(provider_id, account_id);

-- Verification table indexes
CREATE INDEX ASYNC IF NOT EXISTS verification_identifier_idx ON verification(identifier);

-- User Files table indexes
CREATE INDEX ASYNC IF NOT EXISTS user_files_user_idx ON user_files(user_id);
CREATE INDEX ASYNC IF NOT EXISTS user_files_file_idx ON user_files(file_id);

-- User Devices table indexes
CREATE INDEX ASYNC IF NOT EXISTS user_devices_user_idx ON user_devices(user_id);
CREATE INDEX ASYNC IF NOT EXISTS user_devices_device_idx ON user_devices(device_id);
