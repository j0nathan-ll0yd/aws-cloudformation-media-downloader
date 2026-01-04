/**
 * EventBridge Test Helpers
 *
 * Utilities for creating event buses, rules, and publishing events in LocalStack.
 * Used for integration testing event-driven workflows.
 */
import {addSqsTarget, createEventBus, createRule, deleteEventBus, listEventBuses, putEvents} from '../lib/vendor/AWS/EventBridge'
import {retryWithBackoff} from './wait-utils'
import {POLLING, TIMEOUTS} from './timeout-config'

const AWS_REGION = process.env.AWS_REGION || 'us-west-2'
const AWS_ACCOUNT_ID = '000000000000' // LocalStack default account ID

/**
 * Waits for EventBridge to be ready in LocalStack
 * Performs health check by listing event buses and verifying the default bus exists
 * Uses exponential backoff with environment-aware timeouts.
 *
 * @param maxWaitMs - Maximum time to wait in milliseconds (uses environment default if not specified)
 * @returns true if EventBridge is ready, throws if timeout
 */
export async function waitForEventBridgeReady(maxWaitMs?: number): Promise<boolean> {
  const effectiveTimeout = maxWaitMs ?? TIMEOUTS.eventBridgeReady

  const result = await retryWithBackoff(async () => {
    const buses = await listEventBuses()
    // LocalStack should have at least the 'default' event bus
    if (buses.length > 0) {
      return true
    }
    throw new Error('No event buses found')
  }, {
    initialDelayMs: POLLING.initialDelay,
    maxDelayMs: POLLING.maxDelay,
    maxTotalMs: effectiveTimeout,
    jitterFactor: POLLING.jitterFactor,
    description: 'EventBridge readiness'
  })

  return result.value
}

/**
 * Creates a test event bus in LocalStack
 * @param busName - Name of the event bus
 * @returns The event bus ARN
 */
export async function createTestEventBus(busName: string): Promise<string> {
  try {
    return await createEventBus(busName)
  } catch (error) {
    if (error instanceof Error && error.name === 'ResourceAlreadyExistsException') {
      return `arn:aws:events:${AWS_REGION}:${AWS_ACCOUNT_ID}:event-bus/${busName}`
    }
    throw error
  }
}

/**
 * Deletes a test event bus from LocalStack
 * @param busName - Name of the event bus
 */
export async function deleteTestEventBus(busName: string): Promise<void> {
  try {
    await deleteEventBus(busName)
  } catch {
    // Bus might not exist
  }
}

/**
 * Creates a test rule that routes events to an SQS queue
 * @param busName - Name of the event bus
 * @param ruleName - Name of the rule
 * @param detailType - Event detail-type to match
 * @param queueArn - Target SQS queue ARN
 * @returns The rule ARN
 */
export async function createTestRuleWithSqsTarget(busName: string, ruleName: string, detailType: string, queueArn: string): Promise<string> {
  const eventPattern = {source: ['media-downloader'], 'detail-type': [detailType]}
  const ruleArn = await createRule(busName, ruleName, eventPattern)
  await addSqsTarget(busName, ruleName, `${ruleName}-target`, queueArn)
  return ruleArn
}

/**
 * Publishes a test event to an event bus
 * @param busName - Name of the event bus
 * @param detailType - Event detail-type
 * @param detail - Event detail payload
 * @returns Number of failed entries (0 means success)
 */
export async function publishTestEvent(busName: string, detailType: string, detail: Record<string, unknown>): Promise<number> {
  const result = await putEvents([
    {EventBusName: busName, Source: 'media-downloader', DetailType: detailType, Detail: JSON.stringify(detail), Time: new Date()}
  ])
  return result.FailedEntryCount || 0
}

/**
 * Publishes a DownloadRequested event (simulating WebhookFeedly)
 * @param busName - Name of the event bus
 * @param fileId - The file ID
 * @param fileUrl - The video URL
 * @param correlationId - Correlation ID for tracing
 */
export async function publishDownloadRequestedEvent(busName: string, fileId: string, fileUrl: string, correlationId: string): Promise<number> {
  return publishTestEvent(busName, 'DownloadRequested', {fileId, fileUrl, correlationId, timestamp: new Date().toISOString()})
}
