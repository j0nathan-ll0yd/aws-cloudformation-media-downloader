import {DynamoDBDocument} from '@aws-sdk/lib-dynamodb'
import type {DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb'
import {createDynamoDBClient} from './clients'

export type { DynamoDBDocumentClient }

/**
 * DynamoDB DocumentClient for ElectroDB entities.
 *
 * This wrapper provides a shared DocumentClient instance with X-Ray tracing
 * for all ElectroDB entity operations. The DocumentClient handles marshalling
 * and unmarshalling of DynamoDB attribute values automatically.
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/ElectroDB-Testing-Patterns#localstack-setup | DynamoDB DocumentClient Usage}
 */
const dynamoDBClient = createDynamoDBClient()

/**
 * Shared DynamoDB DocumentClient instance.
 * Used by all ElectroDB entities to ensure consistent X-Ray tracing.
 */
export const documentClient: DynamoDBDocument = DynamoDBDocument.from(dynamoDBClient)
