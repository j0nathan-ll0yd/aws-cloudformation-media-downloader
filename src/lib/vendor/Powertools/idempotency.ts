/**
 * AWS Lambda Powertools Idempotency configuration
 * Prevents duplicate processing of webhook requests
 * @see https://docs.aws.amazon.com/powertools/typescript/latest/utilities/idempotency/
 */
import {IdempotencyConfig} from '@aws-lambda-powertools/idempotency'
import {DynamoDBPersistenceLayer} from '@aws-lambda-powertools/idempotency/dynamodb'

/**
 * Get the idempotency table name from environment
 * Lazy initialization to work with Jest mocking
 */
function getTableName(): string {
  const tableName = process.env['IdempotencyTableName']
  if (!tableName) {
    throw new Error('IdempotencyTableName environment variable not set')
  }
  return tableName
}

/**
 * DynamoDB persistence layer for idempotency records
 * Automatically manages record creation, expiration, and cleanup via TTL
 */
export function createPersistenceStore(): DynamoDBPersistenceLayer {
  return new DynamoDBPersistenceLayer({tableName: getTableName()})
}

/**
 * Default idempotency configuration
 * - Uses composite key of userId + fileId for webhook requests
 * - Records expire after 1 hour (webhook deduplication window)
 */
export const defaultIdempotencyConfig = new IdempotencyConfig({
  expiresAfterSeconds: 3600 // 1 hour
})

export { IdempotencyConfig }
