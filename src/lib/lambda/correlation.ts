/**
 * Correlation ID Extraction and Propagation
 *
 * Provides utilities for extracting and propagating correlation IDs across
 * Lambda invocations for end-to-end request tracing.
 *
 * Correlation ID Sources (in priority order):
 * 1. SQS message body (for EventBridge-routed events)
 * 2. API Gateway header (X-Correlation-ID)
 * 3. EventBridge event detail (_correlationId)
 * 4. Generated UUID (for originating requests)
 *
 * @see src/lib/lambda/middleware/ for usage in handlers
 */

import type {APIGatewayProxyEvent, Context, S3Event, SQSEvent} from 'aws-lambda'
import {randomUUID} from 'crypto'
import type {CorrelationContext} from '#types/infrastructureTypes'
import {logDebug} from '#lib/system/logging'

export type { CorrelationContext }

/**
 * EventBridge event structure for correlation ID extraction.
 */
interface EventBridgeEvent {
  detail?: {_correlationId?: string; correlationId?: string}
}

/**
 * Checks if an event is an SQS event.
 */
function isSQSEvent(event: unknown): event is SQSEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'Records' in event &&
    Array.isArray((event as SQSEvent).Records) &&
    (event as SQSEvent).Records.length > 0 &&
    'body' in (event as SQSEvent).Records[0]
  )
}

/**
 * Checks if an event is an API Gateway event.
 */
function isAPIGatewayEvent(event: unknown): event is APIGatewayProxyEvent {
  return typeof event === 'object' && event !== null && 'headers' in event && 'requestContext' in event
}

/**
 * Checks if an event is an EventBridge event.
 */
function isEventBridgeEvent(event: unknown): event is EventBridgeEvent {
  return typeof event === 'object' && event !== null && 'detail' in event && typeof (event as EventBridgeEvent).detail === 'object'
}

/**
 * Checks if an event is an S3 event.
 */
function isS3Event(event: unknown): event is S3Event {
  return (
    typeof event === 'object' &&
    event !== null &&
    'Records' in event &&
    Array.isArray((event as S3Event).Records) &&
    (event as S3Event).Records.length > 0 &&
    's3' in (event as S3Event).Records[0]
  )
}

/**
 * Extracts correlation ID from an SQS message body.
 * EventBridge events routed through SQS embed the correlation ID in the message body.
 */
function extractFromSQS(event: SQSEvent): string | undefined {
  try {
    const body = JSON.parse(event.Records[0].body)
    return body._correlationId || body.correlationId || body.detail?._correlationId || body.detail?.correlationId
  } catch {
    return undefined
  }
}

/**
 * Extracts correlation ID from API Gateway headers.
 * Only uses custom X-Correlation-ID header if provided by client.
 * Does NOT fall back to X-Amzn-Trace-Id (that's for traceId, not correlationId).
 * If no custom header, returns undefined to allow UUID generation.
 */
function extractFromAPIGateway(event: APIGatewayProxyEvent): string | undefined {
  const headers = event.headers || {}
  return headers['X-Correlation-ID'] || headers['x-correlation-id'] || headers['X-Correlation-Id']
}

/**
 * Extracts correlation ID from EventBridge event detail.
 */
function extractFromEventBridge(event: EventBridgeEvent): string | undefined {
  return event.detail?._correlationId || event.detail?.correlationId
}

/**
 * Extracts or generates a correlation ID from various event types.
 *
 * Priority order:
 * 1. SQS message body (EventBridge routed)
 * 2. API Gateway X-Correlation-ID header
 * 3. EventBridge event detail
 * 4. New UUID (for originating requests)
 *
 * @param event - The incoming Lambda event
 * @param context - AWS Lambda context
 * @returns CorrelationContext with traceId and correlationId
 */
export function extractCorrelationId(event: unknown, context: Context): CorrelationContext {
  const traceId = context.awsRequestId
  let correlationId: string | undefined
  logDebug('extractCorrelationId', {event, context})

  // Try SQS message body first (EventBridge routed through SQS)
  if (isSQSEvent(event)) {
    correlationId = extractFromSQS(event)
  }

  // Try API Gateway header
  if (!correlationId && isAPIGatewayEvent(event)) {
    correlationId = extractFromAPIGateway(event)
  }

  // Try EventBridge event detail
  if (!correlationId && isEventBridgeEvent(event)) {
    correlationId = extractFromEventBridge(event)
  }

  // S3 events don't carry correlation ID - use object key as partial identifier
  // The correlation ID would have been logged when the file was uploaded
  if (!correlationId && isS3Event(event)) {
    // For S3 events, we generate a new correlation ID
    // The upload that triggered this would have its own correlation chain
    correlationId = randomUUID()
  }

  // Generate new correlation ID for originating requests
  if (!correlationId) {
    correlationId = randomUUID()
  }

  return {traceId, correlationId}
}
