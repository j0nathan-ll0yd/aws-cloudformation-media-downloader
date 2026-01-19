/**
 * Powertools Vendor Wrapper Permission Decorators
 *
 * Method decorators for declaring DynamoDB permissions on Powertools wrapper functions.
 * These decorators attach permission metadata that is extracted at build time
 * to generate Lambda IAM policies automatically.
 *
 * Note: Re-uses DynamoDB permission types from the existing system.
 *
 * @see docs/wiki/Infrastructure/Lambda-Decorators.md
 */
import type {TablePermissions, WithTablePermissions} from '#types/dynamodbPermissions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any

/**
 * Method decorator that declares DynamoDB permissions on a Powertools wrapper function.
 * Uses the same permission types as @RequiresDynamoDB class decorator.
 *
 * @param permissions - Array of table permissions required by this method
 * @returns Method decorator that attaches permission metadata
 *
 * @example
 * ```typescript
 * class IdempotencyVendor {
 *   @RequiresDynamoDB([{table: DynamoDBResource.IdempotencyTable, operations: [GetItem, PutItem]}])
 *   static createPersistenceStore() {...}
 * }
 * ```
 */
export function RequiresDynamoDB(permissions: TablePermissions) {
  return function(_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value as AnyFunction & WithTablePermissions
    method.dynamodbPermissions = permissions
    return descriptor
  }
}
