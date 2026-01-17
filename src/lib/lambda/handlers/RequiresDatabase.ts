/**
 * Database Permissions Decorator
 *
 * Declarative database access requirements for Lambda handlers.
 * Used for:
 * - Documentation of database access in code
 * - Build-time extraction for PostgreSQL role generation
 * - Terraform configuration generation
 * - MCP validation of declared vs actual usage
 *
 * @see docs/wiki/Infrastructure/Database-Permissions.md
 */
import type {ComputedAccessLevel, DatabasePermissions, WithDatabasePermissions} from '#types/databasePermissions'

/**
 * Class decorator that declares database permissions for a Lambda handler.
 * Attaches metadata to the class constructor for build-time extraction.
 *
 * @example
 * ```typescript
 * @RequiresDatabase({
 *   tables: [
 *     {table: DatabaseTable.Users, operations: [DatabaseOperation.Select]},
 *     {table: DatabaseTable.Files, operations: [DatabaseOperation.Select, DatabaseOperation.Insert]}
 *   ],
 *   description: 'Read users and create files'
 * })
 * class MyHandler extends AuthenticatedHandler { ... }
 * ```
 */
export function RequiresDatabase(permissions: DatabasePermissions) {
  return function<T extends new(...args: unknown[]) => unknown>(constructor: T): T {
    const target = constructor as T & WithDatabasePermissions
    target.__databasePermissions = permissions
    return target
  }
}

/**
 * Retrieve database permissions from a handler class.
 * Returns undefined if no permissions are declared.
 */
export function getDatabasePermissions(handlerClass: unknown): DatabasePermissions | undefined {
  return (handlerClass as WithDatabasePermissions).__databasePermissions
}

/**
 * Compute access level from declared operations.
 * - readonly: Only SELECT operations
 * - readwrite: Any INSERT, UPDATE, or DELETE operations
 * - admin: Not computed (must be explicitly declared)
 */
export function computeAccessLevel(permissions: DatabasePermissions): ComputedAccessLevel {
  const hasWrite = permissions.tables.some((t) => t.operations.some((op) => ['INSERT', 'UPDATE', 'DELETE'].includes(op)))
  return hasWrite ? 'readwrite' : 'readonly'
}
