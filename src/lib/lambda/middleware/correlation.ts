/**
 * Correlation ID Utilities
 *
 * Extracts and propagates correlation IDs for distributed tracing across
 * the event-driven pipeline. Enables tracing a single request from
 * WebhookFeedly → EventBridge → SQS → Lambdas → APNS.
 *
 * @see src/lambdas/WebhookFeedly for correlation ID generation
 * @see src/lib/vendor/AWS/EventBridge for correlation propagation
 */
import type {S3Event, S3EventRecord, SQSRecord} from 'aws-lambda'
import {logger} from '#lib/vendor/Powertools'

/**
 * Extract correlation ID from an SQS record.
 * Correlation IDs are propagated through EventBridge events as message attributes.
 *
 * Priority:
 * 1. SQS message attribute 'correlationId' (from EventBridge)
 * 2. Message body 'correlationId' field (if JSON)
 * 3. SQS messageId as fallback
 *
 * @param record - SQS record from Lambda event
 * @returns The correlation ID string
 */
export function extractCorrelationFromSQS(record: SQSRecord): string {
  // Check message attributes first (set by EventBridge routing)
  const attributeCorrelation = record.messageAttributes?.correlationId?.stringValue
  if (attributeCorrelation) {
    return attributeCorrelation
  }

  // Try parsing body for correlationId (if JSON payload includes it)
  try {
    const body = JSON.parse(record.body) as Record<string, unknown>
    if (typeof body.correlationId === 'string') {
      return body.correlationId
    }
  } catch {
    // Not JSON or parsing failed, fall through
  }

  // Fall back to SQS messageId as a pseudo-correlation ID
  return record.messageId
}

/**
 * Extract correlation ID from an S3 event.
 * Uses the S3 request ID as the correlation ID since S3 events don't carry
 * custom correlation headers.
 *
 * @param event - S3 event from Lambda
 * @returns The correlation ID string (S3 request ID)
 */
export function extractCorrelationFromS3(event: S3Event): string {
  // S3 events use request ID as the trace identifier
  const record = event.Records?.[0]
  if (record?.responseElements?.['x-amz-request-id']) {
    return record.responseElements['x-amz-request-id']
  }
  // Fallback to event source ARN or timestamp-based ID
  return record?.s3?.object?.key || `s3-${Date.now()}`
}

/**
 * Extract correlation ID from an S3 event record.
 * Used when processing individual records in a batch handler.
 *
 * @param record - S3 event record
 * @returns The correlation ID string (S3 request ID)
 */
export function extractCorrelationFromS3Record(record: S3EventRecord): string {
  if (record?.responseElements?.['x-amz-request-id']) {
    return record.responseElements['x-amz-request-id']
  }
  // Fallback to object key or timestamp-based ID
  return record?.s3?.object?.key || `s3-${Date.now()}`
}

/**
 * Append correlation ID to the Powertools logger context.
 * All subsequent log messages will include the correlation ID automatically.
 *
 * @param correlationId - The correlation ID to append
 */
export function appendCorrelationToLogger(correlationId: string): void {
  logger.appendKeys({correlationId})
}

/**
 * Create a correlation-aware logging context.
 * Returns an object with the correlation ID that can be spread into log calls.
 *
 * @param correlationId - The correlation ID to include
 * @returns Object with correlationId key
 */
export function withCorrelation(correlationId: string): {correlationId: string} {
  return {correlationId}
}
