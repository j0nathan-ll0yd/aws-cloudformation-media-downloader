/**
 * DynamoDB Permissions Decorator
 *
 * Declarative DynamoDB access requirements for Lambda handlers.
 * Used for:
 * - Documentation of DynamoDB dependencies in code
 * - Build-time extraction for IAM policy generation
 * - MCP validation of declared vs actual usage
 *
 * @see docs/wiki/Infrastructure/Lambda-Decorators.md
 */
import type {TablePermissions, WithTablePermissions} from '#types/dynamodbPermissions'

/**
 * Class decorator that declares DynamoDB permissions for a Lambda handler.
 * Attaches metadata to the class constructor for build-time extraction.
 *
 * @example
 * ```typescript
 * @RequiresDynamoDB([{table: DynamoDBResource.IdempotencyTable, operations: [DynamoDBOperation.GetItem]}])
 * ```
 */
export function RequiresDynamoDB(permissions: TablePermissions) {
  return function<T extends new(...args: unknown[]) => unknown>(constructor: T): T {
    const target = constructor as T & WithTablePermissions
    target.dynamodbPermissions = permissions
    return target
  }
}

/**
 * Retrieve DynamoDB permissions from a handler class.
 * Returns undefined if no permissions are declared.
 */
export function getDynamoDBPermissions(handlerClass: unknown): TablePermissions | undefined {
  return (handlerClass as WithTablePermissions).dynamodbPermissions
}
