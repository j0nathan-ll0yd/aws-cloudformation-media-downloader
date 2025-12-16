/**
 * Valid Lambda handler fixture
 * This file follows all conventions
 */

import type {APIGatewayProxyEvent} from 'aws-lambda'
import {v4 as uuid} from 'uuid'
import {Users} from '#entities/Users'
import {queryItems} from '#lib/vendor/AWS/DynamoDB'
import {response} from '#util/lambda-helpers'

export async function handler(event: APIGatewayProxyEvent) {
  const userId = event.pathParameters?.userId
  if (!userId) {
    return response(400, {error: 'Missing userId'})
  }

  const user = await Users.get({userId}).go()
  return response(200, {user})
}
