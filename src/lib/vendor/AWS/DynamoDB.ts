import {DynamoDBDocument} from '@aws-sdk/lib-dynamodb'
import type {DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb'
import {createDynamoDBClient} from './clients'

export type { DynamoDBDocumentClient }

/**
 * DynamoDB DocumentClient for idempotency and legacy operations.
 *
 * This wrapper provides a shared DocumentClient instance with X-Ray tracing
 * for DynamoDB operations. The DocumentClient handles marshalling
 * and unmarshalling of DynamoDB attribute values automatically.
 *
 * Note: Primary data operations now use Aurora DSQL via Drizzle ORM.
 * DynamoDB is retained for idempotency tables and specific AWS integrations.
 */
const dynamoDBClient = createDynamoDBClient()

/**
 * Shared DynamoDB DocumentClient instance.
 * Used for DynamoDB operations with consistent X-Ray tracing.
 */
export const documentClient: DynamoDBDocument = DynamoDBDocument.from(dynamoDBClient)
