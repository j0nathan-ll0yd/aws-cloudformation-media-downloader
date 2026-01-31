/**
 * Entity Query Permission Decorators
 *
 * Method decorators for declaring database table permissions on entity query functions.
 * These decorators attach permission metadata that is extracted at build time
 * to determine Lambda database access requirements automatically.
 *
 * The extraction script traces Lambda → entity query dependencies to:
 * 1. Build method -\> permission map (e.g., UserQueries.getUser -\> \{Users, Select\})
 * 2. Use build/graph.json to trace Lambda dependencies
 * 3. Aggregate permissions from all entity query methods each Lambda transitively imports
 * 4. Generate database role permissions for each Lambda
 *
 * @see docs/wiki/Infrastructure/Lambda-Decorators.md
 */
import type {TablePermission} from '#types/databasePermissions'
import {DatabaseOperation, DatabaseTable} from '#types/databasePermissions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any

/**
 * Type augmentation for functions with table permission metadata.
 * The decorator attaches permissions as a property on the method.
 */
export interface WithTablePermissions {
  __tablePermissions?: TablePermission[]
}

/**
 * Method decorator that declares database table permissions on an entity query function.
 * Enables build-time extraction via ts-morph AST analysis for automatic Lambda permission derivation.
 *
 * @param permissions - Array of table permissions required by this method
 * @returns Method decorator that attaches permission metadata
 *
 * @example Single table read
 * ```typescript
 * class UserQueries {
 *   @RequiresTable([{table: DatabaseTable.Users, operations: [DatabaseOperation.Select]}])
 *   static async getUser(id: string): Promise<UserItem | null> {...}
 * }
 * ```
 *
 * @example Multiple tables (JOIN query)
 * ```typescript
 * class RelationshipQueries {
 *   @RequiresTable([
 *     {table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Select]},
 *     {table: DatabaseTable.Files, operations: [DatabaseOperation.Select]}
 *   ])
 *   static async getFilesForUser(userId: string): Promise<FileRow[]> {...}
 * }
 * ```
 *
 * @example Write operation
 * ```typescript
 * class UserQueries {
 *   @RequiresTable([{table: DatabaseTable.Users, operations: [DatabaseOperation.Insert]}])
 *   static async createUser(input: CreateUserInput): Promise<UserItem> {...}
 * }
 * ```
 *
 * @example Cascade delete (multi-table transaction)
 * ```typescript
 * class CascadeOperations {
 *   @RequiresTable([
 *     {table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Delete]},
 *     {table: DatabaseTable.UserDevices, operations: [DatabaseOperation.Delete]},
 *     {table: DatabaseTable.Sessions, operations: [DatabaseOperation.Delete]},
 *     {table: DatabaseTable.Accounts, operations: [DatabaseOperation.Delete]},
 *     {table: DatabaseTable.Users, operations: [DatabaseOperation.Delete]}
 *   ])
 *   static async deleteUserCascade(userId: string): Promise<void> {...}
 * }
 * ```
 */
export function RequiresTable(permissions: TablePermission[]) {
  return function(_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value as AnyFunction & WithTablePermissions
    method.__tablePermissions = permissions
    return descriptor
  }
}

// Re-export types for convenient importing
export { DatabaseOperation, DatabaseTable }
export type { TablePermission }
