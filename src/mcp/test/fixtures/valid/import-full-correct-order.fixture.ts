/**
 * @fixture valid
 * @rule import-order
 * @description Complete correct import order (allowed)
 * @expectedViolations 0
 */
import {join} from 'node:path'
import type {APIGatewayProxyEvent} from 'aws-lambda'
import {v4} from 'uuid'
import {getUser} from '#entities/queries'
import {queryItems} from '#lib/vendor/AWS/DynamoDB'
import type {UserRecord} from '#types/User'
import {buildApiResponse} from '#util/lambda-helpers'
import {helper} from './helper'
