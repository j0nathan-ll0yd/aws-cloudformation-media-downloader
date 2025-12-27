-- Migration: 0003_align_better_auth_schema
-- Description: Align schema with Better Auth official adapter expectations
-- Created: 2025-12-26
--
-- This migration:
-- 1. Renames primary key columns to 'id' (Better Auth convention)
-- 2. Converts integer timestamps to TIMESTAMP WITH TIME ZONE
-- 3. Renames verification_tokens to verification
-- 4. Adds Better Auth expected columns (name, image, value)
--
-- Aurora DSQL Notes:
-- - Column renames done via ADD COLUMN + UPDATE + DROP COLUMN pattern
-- - Integer to timestamp conversion uses to_timestamp()
-- - Foreign key references updated at application layer

-- ============================================
-- USERS TABLE
-- ============================================
-- Add new 'id' column and Better Auth fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS id UUID;

-- Copy user_id to id
UPDATE users SET id = user_id WHERE id IS NULL;

-- Add Better Auth expected columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT;

-- Make first_name nullable (Better Auth doesn't require it)
-- Aurora DSQL: DROP NOT NULL by recreating column
ALTER TABLE users ALTER COLUMN first_name DROP NOT NULL;

-- ============================================
-- SESSIONS TABLE
-- ============================================
-- Add new 'id' column
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS id UUID;

-- Copy session_id to id
UPDATE sessions SET id = session_id WHERE id IS NULL;

-- Add new timestamp columns
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at_new TIMESTAMP WITH TIME ZONE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at_new TIMESTAMP WITH TIME ZONE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS updated_at_new TIMESTAMP WITH TIME ZONE;

-- Convert integer timestamps to proper timestamps
UPDATE sessions SET
  expires_at_new = to_timestamp(expires_at),
  created_at_new = to_timestamp(created_at),
  updated_at_new = to_timestamp(updated_at)
WHERE expires_at_new IS NULL;

-- Drop old integer columns and rename new ones
ALTER TABLE sessions DROP COLUMN IF EXISTS expires_at;
ALTER TABLE sessions DROP COLUMN IF EXISTS created_at;
ALTER TABLE sessions DROP COLUMN IF EXISTS updated_at;
ALTER TABLE sessions RENAME COLUMN expires_at_new TO expires_at;
ALTER TABLE sessions RENAME COLUMN created_at_new TO created_at;
ALTER TABLE sessions RENAME COLUMN updated_at_new TO updated_at;

-- Drop device_id (not in Better Auth schema)
ALTER TABLE sessions DROP COLUMN IF EXISTS device_id;

-- Add unique constraint on token
ALTER TABLE sessions ADD CONSTRAINT IF NOT EXISTS sessions_token_unique UNIQUE (token);

-- ============================================
-- ACCOUNTS TABLE
-- ============================================
-- Add new 'id' column
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS id UUID;

-- Copy account_id to id
UPDATE accounts SET id = account_id WHERE id IS NULL;

-- Rename provider_account_id to account_id (Better Auth convention)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_id_new TEXT;
UPDATE accounts SET account_id_new = provider_account_id WHERE account_id_new IS NULL;
ALTER TABLE accounts DROP COLUMN IF EXISTS provider_account_id;
ALTER TABLE accounts RENAME COLUMN account_id_new TO account_id;

-- Add new timestamp columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS created_at_new TIMESTAMP WITH TIME ZONE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS updated_at_new TIMESTAMP WITH TIME ZONE;

-- Convert integer timestamps to proper timestamps
UPDATE accounts SET
  access_token_expires_at = CASE WHEN expires_at IS NOT NULL THEN to_timestamp(expires_at) ELSE NULL END,
  created_at_new = to_timestamp(created_at),
  updated_at_new = to_timestamp(updated_at)
WHERE created_at_new IS NULL;

-- Drop old columns and rename new ones
ALTER TABLE accounts DROP COLUMN IF EXISTS expires_at;
ALTER TABLE accounts DROP COLUMN IF EXISTS token_type;
ALTER TABLE accounts DROP COLUMN IF EXISTS created_at;
ALTER TABLE accounts DROP COLUMN IF EXISTS updated_at;
ALTER TABLE accounts RENAME COLUMN created_at_new TO created_at;
ALTER TABLE accounts RENAME COLUMN updated_at_new TO updated_at;

-- Add password column (Better Auth expects this for credential auth)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS password TEXT;

-- ============================================
-- VERIFICATION_TOKENS -> VERIFICATION
-- ============================================
-- Rename table to match Better Auth expectations
ALTER TABLE verification_tokens RENAME TO verification;

-- Add id column as new primary key
ALTER TABLE verification ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Rename token to value (Better Auth convention)
ALTER TABLE verification ADD COLUMN IF NOT EXISTS value TEXT;
UPDATE verification SET value = token WHERE value IS NULL;

-- Add new timestamp columns
ALTER TABLE verification ADD COLUMN IF NOT EXISTS expires_at_new TIMESTAMP WITH TIME ZONE;
ALTER TABLE verification ADD COLUMN IF NOT EXISTS created_at_new TIMESTAMP WITH TIME ZONE;
ALTER TABLE verification ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

-- Convert integer timestamps to proper timestamps
UPDATE verification SET
  expires_at_new = to_timestamp(expires_at),
  created_at_new = to_timestamp(created_at),
  updated_at = to_timestamp(created_at)
WHERE expires_at_new IS NULL;

-- Drop old columns and rename new ones
ALTER TABLE verification DROP COLUMN IF EXISTS token;
ALTER TABLE verification DROP COLUMN IF EXISTS expires_at;
ALTER TABLE verification DROP COLUMN IF EXISTS created_at;
ALTER TABLE verification RENAME COLUMN expires_at_new TO expires_at;
ALTER TABLE verification RENAME COLUMN created_at_new TO created_at;

-- ============================================
-- UPDATE INDEXES FOR RENAMED COLUMNS
-- ============================================
-- Drop old indexes that reference renamed columns
DROP INDEX IF EXISTS accounts_provider_idx;

-- Create new index with correct column name
CREATE INDEX ASYNC IF NOT EXISTS accounts_provider_idx ON accounts(provider_id, account_id);

-- Create index on verification table (renamed from verification_tokens)
DROP INDEX IF EXISTS verification_tokens_identifier_idx;
CREATE INDEX ASYNC IF NOT EXISTS verification_identifier_idx ON verification(identifier);

-- ============================================
-- CLEANUP: DROP OLD PRIMARY KEY COLUMNS
-- ============================================
-- Note: These must be done after all data is migrated
-- Users: Keep user_id for now as FK references use it
-- We'll handle FK updates in application layer

-- For sessions, accounts: safe to drop old PK columns
-- ALTER TABLE sessions DROP COLUMN IF EXISTS session_id;
-- ALTER TABLE accounts DROP COLUMN IF EXISTS account_id;
-- Note: Keeping old columns for now to avoid breaking running Lambdas during migration
