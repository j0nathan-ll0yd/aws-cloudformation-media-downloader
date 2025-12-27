/**
 * Drizzle ORM Schema Definitions for Aurora DSQL
 *
 * This module defines all database tables for the MediaDownloader service.
 * All tables are normalized (no JSONB, as Aurora DSQL doesn't support it).
 *
 * Key changes from ElectroDB/DynamoDB:
 * - Users.identityProviders embedded map -> separate identity_providers table
 * - GSI patterns -> PostgreSQL indexes
 * - Single-table design -> normalized relational tables
 * - TTL attribute -> scheduled cleanup Lambda
 */
import {boolean, index, integer, pgTable, primaryKey, text, timestamp, uuid} from 'drizzle-orm/pg-core'

/**
 * Users table - Core user account management.
 *
 * Manages user accounts with Sign In With Apple integration.
 * Identity providers are now in a separate normalized table.
 *
 * Indexes:
 * - usersEmailIdx: Lookup by email (login flow)
 * - usersAppleDeviceIdx: Lookup by Apple device ID (token refresh)
 */
export const users = pgTable('users', {
  userId: uuid('user_id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  firstName: text('first_name').notNull(),
  lastName: text('last_name'),
  appleDeviceId: text('apple_device_id'),
  createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull()
}, (table) => [
  index('users_email_idx').on(table.email),
  index('users_apple_device_idx').on(table.appleDeviceId)
])

/**
 * Identity Providers table - Normalized from Users.identityProviders JSONB.
 *
 * Stores OAuth tokens for Sign In With Apple.
 * One-to-one relationship with users (could be one-to-many for multiple providers).
 *
 * Foreign key to users enforced at application layer (Aurora DSQL limitation).
 */
export const identityProviders = pgTable('identity_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  providerUserId: text('provider_user_id').notNull(),
  email: text('email').notNull(),
  emailVerified: boolean('email_verified').notNull(),
  isPrivateEmail: boolean('is_private_email').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  tokenType: text('token_type').notNull(),
  expiresAt: integer('expires_at').notNull()
}, (table) => [
  index('identity_providers_user_idx').on(table.userId)
])

/**
 * Files table - Video metadata storage.
 *
 * Stores permanent metadata about downloaded media files.
 * Status transitions: Queued -> Downloading -> Downloaded | Failed
 *
 * Indexes:
 * - filesKeyIdx: Lookup by S3 object key (S3ObjectCreated Lambda)
 */
export const files = pgTable('files', {
  fileId: text('file_id').primaryKey(),
  size: integer('size').notNull().default(0),
  authorName: text('author_name').notNull(),
  authorUser: text('author_user').notNull(),
  publishDate: text('publish_date').notNull(),
  description: text('description').notNull(),
  key: text('key').notNull(),
  url: text('url'),
  contentType: text('content_type').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull().default('Queued')
}, (table) => [
  index('files_key_idx').on(table.key)
])

/**
 * FileDownloads table - Download orchestration state.
 *
 * Tracks transient download state (retries, scheduling, errors).
 * Separated from Files to keep permanent metadata clean.
 *
 * Cleanup: Handled by scheduled CleanupExpiredRecords Lambda (no TTL in DSQL).
 *
 * Indexes:
 * - fileDownloadsStatusIdx: Query by status and retryAfter (scheduler)
 */
export const fileDownloads = pgTable('file_downloads', {
  fileId: text('file_id').primaryKey(),
  status: text('status').notNull().default('Pending'),
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(5),
  retryAfter: integer('retry_after'),
  errorCategory: text('error_category'),
  lastError: text('last_error'),
  scheduledReleaseTime: integer('scheduled_release_time'),
  sourceUrl: text('source_url'),
  correlationId: text('correlation_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => [
  index('file_downloads_status_idx').on(table.status, table.retryAfter)
])

/**
 * Devices table - iOS device registration for push notifications.
 *
 * Stores APNS device tokens and SNS endpoint ARNs.
 * Lifecycle managed by RegisterDevice and PruneDevices Lambdas.
 */
export const devices = pgTable('devices', {
  deviceId: text('device_id').primaryKey(),
  name: text('name').notNull(),
  token: text('token').notNull(),
  systemVersion: text('system_version').notNull(),
  systemName: text('system_name').notNull(),
  endpointArn: text('endpoint_arn').notNull()
})

/**
 * Sessions table - Better Auth user session management.
 *
 * Stores authentication sessions with automatic expiration.
 * Expired sessions cleaned up by CleanupExpiredRecords Lambda.
 *
 * Indexes:
 * - sessionsUserIdx: Get all sessions for a user (logout-all)
 * - sessionsTokenIdx: Validate session token (request auth)
 */
export const sessions = pgTable('sessions', {
  sessionId: uuid('session_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  expiresAt: integer('expires_at').notNull(),
  token: text('token').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  deviceId: text('device_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => [
  index('sessions_user_idx').on(table.userId),
  index('sessions_token_idx').on(table.token)
])

/**
 * Accounts table - Better Auth OAuth account storage.
 *
 * Stores OAuth provider account linkages.
 *
 * Indexes:
 * - accountsUserIdx: Get all accounts for a user
 * - accountsProviderIdx: Lookup by provider + providerAccountId
 */
export const accounts = pgTable('accounts', {
  accountId: uuid('account_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  providerId: text('provider_id').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: integer('expires_at'),
  scope: text('scope'),
  tokenType: text('token_type'),
  idToken: text('id_token'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => [
  index('accounts_user_idx').on(table.userId),
  index('accounts_provider_idx').on(table.providerId, table.providerAccountId)
])

/**
 * VerificationTokens table - Better Auth verification tokens.
 *
 * Stores email verification and password reset tokens.
 * Expired tokens cleaned up by CleanupExpiredRecords Lambda.
 *
 * Indexes:
 * - verificationTokensIdentifierIdx: Lookup by identifier
 */
export const verificationTokens = pgTable('verification_tokens', {
  token: text('token').primaryKey(),
  identifier: text('identifier').notNull(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull()
}, (table) => [
  index('verification_tokens_identifier_idx').on(table.identifier)
])

/**
 * UserFiles table - Many-to-many relationship between users and files.
 *
 * Enables bidirectional queries:
 * - "What files does this user have?" (userFilesUserIdx)
 * - "What users have this file?" (userFilesFileIdx)
 *
 * Foreign keys to users/files enforced at application layer.
 */
export const userFiles = pgTable('user_files', {
  userId: uuid('user_id').notNull(),
  fileId: text('file_id').notNull(),
  createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull()
}, (table) => [
  primaryKey({columns: [table.userId, table.fileId]}),
  index('user_files_user_idx').on(table.userId),
  index('user_files_file_idx').on(table.fileId)
])

/**
 * UserDevices table - Many-to-many relationship between users and devices.
 *
 * Enables bidirectional queries:
 * - "What devices does this user have?" (userDevicesUserIdx)
 * - "What users are on this device?" (userDevicesDeviceIdx)
 *
 * Foreign keys to users/devices enforced at application layer.
 */
export const userDevices = pgTable('user_devices', {
  userId: uuid('user_id').notNull(),
  deviceId: text('device_id').notNull(),
  createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull()
}, (table) => [
  primaryKey({columns: [table.userId, table.deviceId]}),
  index('user_devices_user_idx').on(table.userId),
  index('user_devices_device_idx').on(table.deviceId)
])
