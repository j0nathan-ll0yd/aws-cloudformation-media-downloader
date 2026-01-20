/**
 * AWS Lambda Powertools Idempotency configuration
 * Prevents duplicate processing of webhook requests
 * @see https://docs.aws.amazon.com/powertools/typescript/latest/utilities/idempotency/
 */
import {IdempotencyConfig, makeIdempotent} from '@aws-lambda-powertools/idempotency'
import {DynamoDBPersistenceLayer} from '@aws-lambda-powertools/idempotency/dynamodb'
import {createDynamoDBClient} from '#lib/vendor/AWS/clients'
import {DynamoDBOperation, DynamoDBResource} from '#types/dynamodbPermissions'
import {RequiresDynamoDB} from './decorators'

/**
 * Get the idempotency table name from environment
 * Lazy initialization to work with Jest mocking
 */
function getTableName(): string {
  const tableName = process.env['IDEMPOTENCY_TABLE_NAME']
  if (!tableName) {
    throw new Error('IDEMPOTENCY_TABLE_NAME environment variable not set')
  }
  return tableName
}

/**
 * Idempotency vendor wrapper with declarative permission metadata.
 * Permissions are extracted at build time to generate Lambda IAM policies.
 */
class IdempotencyVendor {
  /**
   * DynamoDB persistence layer for idempotency records.
   * Automatically manages record creation, expiration, and cleanup via TTL.
   * Uses project's LocalStack-aware DynamoDB client for testing compatibility.
   *
   * Requires all CRUD operations on IdempotencyTable:
   * - GetItem: Check if request already processed
   * - PutItem: Store new idempotency record
   * - UpdateItem: Update record status (in_progress → completed)
   * - DeleteItem: Cleanup expired records
   */
  @RequiresDynamoDB([{
    table: DynamoDBResource.IdempotencyTable,
    operations: [
      DynamoDBOperation.GetItem,
      DynamoDBOperation.PutItem,
      DynamoDBOperation.UpdateItem,
      DynamoDBOperation.DeleteItem
    ]
  }])
  static createPersistenceStore(): DynamoDBPersistenceLayer {
    return new DynamoDBPersistenceLayer({tableName: getTableName(), awsSdkV3Client: createDynamoDBClient()})
  }
}

// Re-export static methods as named exports
export const createPersistenceStore = IdempotencyVendor.createPersistenceStore.bind(IdempotencyVendor)

// Export class for extraction script access
export { IdempotencyVendor }

/**
 * Default idempotency configuration
 * - Uses composite key of userId + fileId for webhook requests
 * - Records expire after 1 hour (webhook deduplication window)
 */
export const defaultIdempotencyConfig = new IdempotencyConfig({
  expiresAfterSeconds: 3600 // 1 hour
})

export { IdempotencyConfig, makeIdempotent }
