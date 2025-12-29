/**
 * @fixture valid
 * @rule import-order
 * @description Correct import order (allowed)
 * @expectedViolations 0
 */
import type {APIGatewayProxyEvent} from 'aws-lambda'
import {v4} from 'uuid'
import {getUser} from '#entities/queries'
