/**
 * Invalid Lambda handler fixture - AWS SDK violation
 * This file directly imports AWS SDK (forbidden)
 */

import type {APIGatewayProxyEvent} from 'aws-lambda'
import {DynamoDBClient} from '@aws-sdk/client-dynamodb'
import {response} from '#util/lambda-helpers'

const client = new DynamoDBClient({})

export async function handler(event: APIGatewayProxyEvent) {
  return response(200, {message: 'hello'})
}
