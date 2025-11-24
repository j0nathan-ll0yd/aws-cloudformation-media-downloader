import {DynamoDBDocument} from '@aws-sdk/lib-dynamodb'
import {createDynamoDBClient} from './clients'

/**
 * DynamoDB DocumentClient for ElectroDB entities.
 *
 * This wrapper provides a shared DocumentClient instance with X-Ray tracing
 * for all ElectroDB entity operations. The DocumentClient handles marshalling
 * and unmarshalling of DynamoDB attribute values automatically.
 *
 * @example
 * import {documentClient} from '../../lib/vendor/AWS/DynamoDB'
 *
 * const client = DynamoDBDocument.from(dynamoDBClient)
 */
const dynamoDBClient = createDynamoDBClient()

/**
 * Shared DynamoDB DocumentClient instance.
 * Used by all ElectroDB entities to ensure consistent X-Ray tracing.
 */
export const documentClient = DynamoDBDocument.from(dynamoDBClient)
