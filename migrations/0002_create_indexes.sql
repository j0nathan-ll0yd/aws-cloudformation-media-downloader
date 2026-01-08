-- Migration: 0002_create_indexes
-- Description: Create indexes for Aurora DSQL
-- Created: 2025-12-26
--
-- Aurora DSQL requires CREATE INDEX ASYNC for non-blocking index creation.
-- All indexes use IF NOT EXISTS for idempotency.

-- Users table indexes
CREATE INDEX ASYNC IF NOT EXISTS users_email_idx ON users(email);
-- NOTE: users_apple_device_idx removed (apple_device_id column deprecated)

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

-- Identity Providers table indexes
CREATE INDEX ASYNC IF NOT EXISTS identity_providers_user_idx ON identity_providers(user_id);

-- User Files table indexes
CREATE INDEX ASYNC IF NOT EXISTS user_files_user_idx ON user_files(user_id);
CREATE INDEX ASYNC IF NOT EXISTS user_files_file_idx ON user_files(file_id);

-- User Devices table indexes
CREATE INDEX ASYNC IF NOT EXISTS user_devices_user_idx ON user_devices(user_id);
CREATE INDEX ASYNC IF NOT EXISTS user_devices_device_idx ON user_devices(device_id);
