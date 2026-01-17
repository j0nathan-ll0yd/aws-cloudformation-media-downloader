/**
 * Drizzle ORM Schema Definitions for Aurora DSQL
 *
 * This module defines all database tables for the MediaDownloader service.
 * All tables are normalized (no JSONB, as Aurora DSQL doesn't support it).
 *
 * Better Auth Integration:
 * - Tables: users, sessions, accounts, verification (Better Auth core tables)
 * - Primary keys: 'id' field (Better Auth convention)
 * - Timestamps: All use TIMESTAMP WITH TIME ZONE (Better Auth expects Date objects)
 *
 * Key changes from DynamoDB:
 * - GSI patterns become PostgreSQL indexes
 * - Single-table design becomes normalized relational tables
 * - TTL attribute becomes scheduled cleanup Lambda
 */
import {boolean, index, integer, pgTable, primaryKey, text, timestamp, unique, uuid} from 'drizzle-orm/pg-core'

/**
 * Users table - Core user account management (Better Auth).
 *
 * Manages user accounts with Sign In With Apple integration.
 * OAuth account data stored in Better Auth's accounts table.
 *
 * Indexes:
 * - usersEmailIdx: Lookup by email (login flow)
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: text('name'),
  image: text('image'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull()
}, (table) => [
  index('users_email_idx').on(table.email)
])

/**
 * Files table - Video metadata storage.
 *
 * Stores permanent metadata about downloaded media files.
 * Status transitions: Queued, Downloading, Downloaded, Failed
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
  retryAfter: timestamp('retry_after', {withTimezone: true}),
  errorCategory: text('error_category'),
  lastError: text('last_error'),
  scheduledReleaseTime: timestamp('scheduled_release_time', {withTimezone: true}),
  sourceUrl: text('source_url'),
  correlationId: text('correlation_id'),
  createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull()
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
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  token: text('token').notNull(),
  expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull()
}, (table) => [
  unique('sessions_token_unique').on(table.token),
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
 * - accountsProviderIdx: Lookup by provider + accountId
 */
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', {withTimezone: true}),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {withTimezone: true}),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull()
}, (table) => [
  index('accounts_user_idx').on(table.userId),
  index('accounts_provider_idx').on(table.providerId, table.accountId)
])

/**
 * Verification table - Better Auth verification tokens.
 *
 * Stores email verification and password reset tokens.
 * Expired tokens cleaned up by CleanupExpiredRecords Lambda.
 *
 * Indexes:
 * - verificationIdentifierIdx: Lookup by identifier
 */
export const verification = pgTable('verification', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
  createdAt: timestamp('created_at', {withTimezone: true}).defaultNow(),
  updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow()
}, (table) => [
  index('verification_identifier_idx').on(table.identifier)
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
