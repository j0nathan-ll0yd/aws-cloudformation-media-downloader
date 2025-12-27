-- Migration: 0001_initial_schema
-- Description: Initial database schema for Aurora DSQL
-- Created: 2025-12-26
--
-- This migration creates all tables for the MediaDownloader service.
-- Tables are created with IF NOT EXISTS for idempotency.
--
-- Aurora DSQL Notes:
-- - Foreign keys are defined but NOT enforced (Aurora DSQL limitation)
-- - Application-layer validation handles referential integrity
-- - Indexes are created in a separate migration using CREATE INDEX ASYNC

-- Schema migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Users table - Core user account management
-- Manages user accounts with Sign In With Apple integration
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  apple_device_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Identity Providers table - OAuth tokens for Sign In With Apple
-- One-to-one relationship with users (could be one-to-many for multiple providers)
CREATE TABLE IF NOT EXISTS identity_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider_user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL,
  is_private_email BOOLEAN NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Files table - Video metadata storage
-- Status transitions: Queued -> Downloading -> Downloaded | Failed
CREATE TABLE IF NOT EXISTS files (
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

-- File Downloads table - Download orchestration state
-- Tracks transient download state (retries, scheduling, errors)
-- Cleanup: Handled by scheduled CleanupExpiredRecords Lambda
CREATE TABLE IF NOT EXISTS file_downloads (
  file_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'Pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  retry_after INTEGER,
  error_category TEXT,
  last_error TEXT,
  scheduled_release_time INTEGER,
  source_url TEXT,
  correlation_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Devices table - iOS device registration for push notifications
-- Stores APNS device tokens and SNS endpoint ARNs
CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token TEXT NOT NULL,
  system_version TEXT NOT NULL,
  system_name TEXT NOT NULL,
  endpoint_arn TEXT NOT NULL
);

-- Sessions table - Better Auth user session management
-- Expired sessions cleaned up by CleanupExpiredRecords Lambda
CREATE TABLE IF NOT EXISTS sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  expires_at INTEGER NOT NULL,
  token TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  device_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Accounts table - Better Auth OAuth account storage
-- Stores OAuth provider account linkages
CREATE TABLE IF NOT EXISTS accounts (
  account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider_id TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at INTEGER,
  scope TEXT,
  token_type TEXT,
  id_token TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Verification Tokens table - Better Auth verification tokens
-- Expired tokens cleaned up by CleanupExpiredRecords Lambda
CREATE TABLE IF NOT EXISTS verification_tokens (
  token TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- User Files table - Many-to-many relationship between users and files
-- Enables bidirectional queries: user's files, file's users
CREATE TABLE IF NOT EXISTS user_files (
  user_id UUID NOT NULL,
  file_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, file_id)
);

-- User Devices table - Many-to-many relationship between users and devices
-- Enables bidirectional queries: user's devices, device's users
CREATE TABLE IF NOT EXISTS user_devices (
  user_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, device_id)
);
