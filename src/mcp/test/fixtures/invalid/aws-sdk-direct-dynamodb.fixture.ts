/**
 * @fixture invalid
 * @rule aws-sdk-encapsulation
 * @severity CRITICAL
 * @description Direct DynamoDB SDK import (forbidden)
 * @expectedViolations 1
 */
import {DynamoDBClient} from '@aws-sdk/client-dynamodb'

const client = new DynamoDBClient({})
export { client }
