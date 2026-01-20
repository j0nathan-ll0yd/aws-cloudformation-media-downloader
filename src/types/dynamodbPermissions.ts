/**
 * DynamoDB Permission Types for Lambda Handlers
 *
 * These types enable explicit declaration of DynamoDB access requirements
 * in Lambda handler code via the @RequiresDynamoDB decorator.
 *
 * The declared permissions are extracted at build time and used to:
 * - Generate IAM policy documents for DynamoDB access
 * - Validate that declared permissions match actual usage
 *
 * @see docs/wiki/Infrastructure/Lambda-Decorators.md
 */
import {DynamoDBResource} from './generatedResources'

// Re-export DynamoDBResource from generated enums for convenience
export { DynamoDBResource }

/**
 * DynamoDB operation types matching IAM policy actions.
 * Maps directly to DynamoDB IAM permission actions.
 */
export enum DynamoDBOperation {
  GetItem = 'dynamodb:GetItem',
  PutItem = 'dynamodb:PutItem',
  UpdateItem = 'dynamodb:UpdateItem',
  DeleteItem = 'dynamodb:DeleteItem',
  Query = 'dynamodb:Query',
  Scan = 'dynamodb:Scan',
  BatchGetItem = 'dynamodb:BatchGetItem',
  BatchWriteItem = 'dynamodb:BatchWriteItem'
}

/**
 * Permission declaration for a single DynamoDB table.
 * Specifies which operations (GetItem, PutItem, etc.) are required.
 */
export interface TablePermission {
  /** The DynamoDB table requiring access */
  table: DynamoDBResource
  /** The operations required on this table */
  operations: DynamoDBOperation[]
}

/**
 * DynamoDB permissions declaration for a Lambda handler.
 * An array of table permissions specifying required access.
 *
 * @example
 * ```typescript
 * @RequiresDynamoDB([{table: DynamoDBResource.IdempotencyTable, operations: [DynamoDBOperation.GetItem]}])
 * ```
 */
export type TablePermissions = TablePermission[]

/**
 * Type augmentation for handler classes with DynamoDB permissions metadata.
 * The decorator attaches permissions as a static property.
 */
export interface WithTablePermissions {
  dynamodbPermissions?: TablePermissions
}
