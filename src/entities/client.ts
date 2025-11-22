import {DynamoDBDocument} from '@aws-sdk/lib-dynamodb'
import {createDynamoDBClient} from '../lib/vendor/AWS/clients'

/**
 * Shared DynamoDB DocumentClient for ElectroDB entities.
 * This ensures all entities use the same client instance with X-Ray tracing.
 */
const dynamoDBClient = createDynamoDBClient()
export const documentClient = DynamoDBDocument.from(dynamoDBClient)
