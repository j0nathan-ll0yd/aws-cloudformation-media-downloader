/**
 * Database Permission Types for Lambda Handlers
 *
 * These types enable explicit declaration of database access requirements
 * in Lambda handler code via the DATABASE_PERMISSIONS export.
 *
 * The declared permissions are extracted at build time and used to:
 * - Generate PostgreSQL role definitions with GRANT statements
 * - Generate Terraform configuration for access levels
 * - Validate that declared permissions match actual query usage
 *
 * @see docs/wiki/Infrastructure/Database-Permissions.md
 */

/**
 * Database operation types matching PostgreSQL privileges.
 * Maps directly to PostgreSQL GRANT statement operations.
 */
export enum DatabaseOperation {
  Select = 'SELECT',
  Insert = 'INSERT',
  Update = 'UPDATE',
  Delete = 'DELETE',
  /** All operations (SELECT, INSERT, UPDATE, DELETE) - use for admin/migration lambdas */
  All = 'ALL'
}

/**
 * Database tables matching Drizzle schema table names.
 * Values use snake_case to match PostgreSQL table naming.
 *
 * @see src/lib/vendor/Drizzle/schema.ts
 */
export enum DatabaseTable {
  Users = 'users',
  Files = 'files',
  FileDownloads = 'file_downloads',
  Devices = 'devices',
  Sessions = 'sessions',
  Accounts = 'accounts',
  VerificationTokens = 'verification_tokens',
  UserFiles = 'user_files',
  UserDevices = 'user_devices'
}

/**
 * Permission declaration for a single database table.
 * Specifies which operations (SELECT, INSERT, UPDATE, DELETE) are required.
 */
export interface TablePermission {
  /** The database table requiring access */
  table: DatabaseTable
  /** The operations required on this table */
  operations: DatabaseOperation[]
}

/**
 * Full database permissions declaration for a Lambda handler.
 *
 * @example
 * ```typescript
 * import {DatabaseOperation, DatabaseTable, type DatabasePermissions} from '#types/databasePermissions'
 *
 * @RequiresDatabase({
 *   tables: [
 *     {table: DatabaseTable.Users, operations: [DatabaseOperation.Select]},
 *     {table: DatabaseTable.Files, operations: [DatabaseOperation.Select, DatabaseOperation.Insert]}
 *   ]
 * })
 * class MyHandler extends ApiHandler { ... }
 * ```
 */
export interface DatabasePermissions {
  /** Table permissions required by this handler */
  tables: TablePermission[]
}

/**
 * Computed access level based on declared permissions.
 * Automatically determined from the operations declared.
 *
 * - readonly: Only SELECT operations
 * - readwrite: Any INSERT, UPDATE, or DELETE operations
 * - admin: Full DDL/DML access (for migrations)
 */
export type ComputedAccessLevel = 'readonly' | 'readwrite' | 'admin'

/**
 * Type augmentation for handler classes with database permissions metadata.
 * The decorator attaches permissions as a static property.
 */
export interface WithDatabasePermissions {
  __databasePermissions?: DatabasePermissions
}

/**
 * Constant name for Lambda database permissions export.
 * Used by the extraction script to find permissions declarations.
 */
export const DATABASE_PERMISSIONS_EXPORT_NAME = 'DATABASE_PERMISSIONS'
