-- Migration: 0002_create_indexes
-- Description: Create indexes for Aurora DSQL
-- Created: 2025-12-26
--
-- Aurora DSQL requires CREATE INDEX ASYNC for non-blocking index creation.
-- This provides zero-downtime index creation on large tables.
--
-- All indexes use IF NOT EXISTS for idempotency.

-- Users table indexes
-- users_email_idx: Lookup by email (login flow)
CREATE INDEX ASYNC IF NOT EXISTS users_email_idx ON users(email);

-- users_apple_device_idx: Lookup by Apple device ID (token refresh)
CREATE INDEX ASYNC IF NOT EXISTS users_apple_device_idx ON users(apple_device_id);

-- Identity Providers table indexes
-- identity_providers_user_idx: Get identity providers for a user
CREATE INDEX ASYNC IF NOT EXISTS identity_providers_user_idx ON identity_providers(user_id);

-- Files table indexes
-- files_key_idx: Lookup by S3 object key (S3ObjectCreated Lambda)
CREATE INDEX ASYNC IF NOT EXISTS files_key_idx ON files(key);

-- File Downloads table indexes
-- file_downloads_status_idx: Query by status and retryAfter (scheduler)
CREATE INDEX ASYNC IF NOT EXISTS file_downloads_status_idx ON file_downloads(status, retry_after);

-- Sessions table indexes
-- sessions_user_idx: Get all sessions for a user (logout-all)
CREATE INDEX ASYNC IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- sessions_token_idx: Validate session token (request auth)
CREATE INDEX ASYNC IF NOT EXISTS sessions_token_idx ON sessions(token);

-- Accounts table indexes
-- accounts_user_idx: Get all accounts for a user
CREATE INDEX ASYNC IF NOT EXISTS accounts_user_idx ON accounts(user_id);

-- accounts_provider_idx: Lookup by provider + providerAccountId
CREATE INDEX ASYNC IF NOT EXISTS accounts_provider_idx ON accounts(provider_id, provider_account_id);

-- Verification Tokens table indexes
-- verification_tokens_identifier_idx: Lookup by identifier
CREATE INDEX ASYNC IF NOT EXISTS verification_tokens_identifier_idx ON verification_tokens(identifier);

-- User Files table indexes
-- user_files_user_idx: Get all files for a user
CREATE INDEX ASYNC IF NOT EXISTS user_files_user_idx ON user_files(user_id);

-- user_files_file_idx: Get all users for a file
CREATE INDEX ASYNC IF NOT EXISTS user_files_file_idx ON user_files(file_id);

-- User Devices table indexes
-- user_devices_user_idx: Get all devices for a user
CREATE INDEX ASYNC IF NOT EXISTS user_devices_user_idx ON user_devices(user_id);

-- user_devices_device_idx: Get all users for a device
CREATE INDEX ASYNC IF NOT EXISTS user_devices_device_idx ON user_devices(device_id);
