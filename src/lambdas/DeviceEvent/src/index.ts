/**
 * LogClientEvent Lambda
 *
 * Receives and logs events from the iOS client for debugging and analytics.
 * Simple pass-through to CloudWatch logs for later analysis.
 *
 * Trigger: API Gateway POST /events
 * Input: JSON payload with device ID and event message
 * Output: 204 No Content on success
 */

import type {APIGatewayEvent, APIGatewayProxyResult} from 'aws-lambda'
import type {ApiHandlerParams} from '#types/lambda'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapApiHandler} from '#lib/lambda/middleware/api'
import {logInfo} from '#lib/system/logging'

/**
 * Logs client-side events for debugging and analytics.
 * @notExported
 */
export const handler = withPowertools(wrapApiHandler(async ({event, context}: ApiHandlerParams<APIGatewayEvent>): Promise<APIGatewayProxyResult> => {
  const deviceId = event.headers['x-device-uuid']
  const message = event.body
  logInfo('Event received', {deviceId, message})
  return buildValidatedResponse(context, 204)
}))
