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

import type {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {addAnnotation, endSpan, startSpan} from '#lib/vendor/OpenTelemetry'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {ApiHandler, metrics, MetricUnit} from '#lib/lambda/handlers'
import {logInfo} from '#lib/system/logging'

/**
 * Handler for client-side device events.
 * Logs events for debugging and analytics.
 */
class DeviceEventHandler extends ApiHandler<APIGatewayEvent> {
  readonly operationName = 'DeviceEvent'

  protected async handleRequest(event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> {
    // Track device event received
    metrics.addMetric('DeviceEventReceived', MetricUnit.Count, 1)

    const span = startSpan('device-event-log')
    const deviceId = event.headers['x-device-uuid']
    if (deviceId) {
      addAnnotation(span, 'deviceId', deviceId)
    }

    const message = event.body
    logInfo('Event received', {deviceId, message})
    endSpan(span)

    return buildValidatedResponse(context, 204)
  }
}

const handlerInstance = new DeviceEventHandler()
export const handler = handlerInstance.handler.bind(handlerInstance)
