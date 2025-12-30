/**
 * EventBridge Vendor Wrapper
 *
 * Encapsulates AWS EventBridge SDK operations for publishing domain events.
 * Follows the AWS SDK Encapsulation Policy - all EventBridge access goes through this module.
 *
 * @see src/lib/vendor/AWS/clients.ts for client factory
 * @see src/types/events.ts for event type definitions
 */

import {PutEventsCommand} from '@aws-sdk/client-eventbridge'
import type {PutEventsRequestEntry, PutEventsResponse} from '@aws-sdk/client-eventbridge'
import {createEventBridgeClient} from './clients'
import {getRequiredEnv} from '#lib/system/env'
import {logDebug, logInfo} from '#lib/system/logging'
import {calculateDelayWithJitter, sleep} from '#lib/system/retry'
import type {MediaDownloaderEventType} from '#types/events'

const eventBridge = createEventBridgeClient()

export type { PutEventsRequestEntry, PutEventsResponse }

/**
 * Publish events to EventBridge.
 *
 * Low-level function that sends an array of event entries to EventBridge.
 * For domain events, prefer using publishEvent() which handles envelope construction.
 *
 * @param entries - Array of event entries to publish
 * @returns PutEvents response with any failed entries
 */
export async function putEvents(entries: PutEventsRequestEntry[]): Promise<PutEventsResponse> {
  logDebug('putEvents <=', {entryCount: entries.length})
  const command = new PutEventsCommand({Entries: entries})
  const response = await eventBridge.send(command)
  logDebug('putEvents =>', {failedEntryCount: response.FailedEntryCount})
  return response
}

/**
 * Options for publishing events with correlation context.
 */
export interface PublishEventOptions {
  /** Correlation ID for end-to-end request tracing */
  correlationId?: string
  /** AWS request ID for this Lambda invocation */
  traceId?: string
}

/**
 * Publish a single domain event to the MediaDownloader event bus.
 *
 * Constructs the EventBridge envelope with standard source and bus name,
 * then publishes the event. Returns the response for error handling.
 *
 * When correlationId is provided, it is embedded in the event detail as _correlationId
 * for downstream Lambda functions to extract and continue the correlation chain.
 *
 * @param detailType - Event type for routing (e.g., 'DownloadRequested')
 * @param detail - Event payload (will be JSON-stringified)
 * @param options - Optional correlation context for distributed tracing
 * @returns PutEvents response
 * @throws Error if EVENT_BUS_NAME environment variable is not set
 * @see src/types/events.ts for event type definitions and usage examples
 */
export async function publishEvent<TDetail>(
  detailType: MediaDownloaderEventType,
  detail: TDetail,
  options?: PublishEventOptions
): Promise<PutEventsResponse> {
  const eventBusName = getRequiredEnv('EVENT_BUS_NAME')

  // Embed correlation context in the event detail for downstream extraction
  const enrichedDetail = {
    ...detail,
    ...(options?.correlationId && {_correlationId: options.correlationId}),
    ...(options?.traceId && {_traceId: options.traceId})
  }

  const entry: PutEventsRequestEntry = {
    EventBusName: eventBusName,
    Source: 'media-downloader',
    DetailType: detailType,
    Detail: JSON.stringify(enrichedDetail),
    Time: new Date()
  }

  logDebug('publishEvent <=', {detailType, eventBusName, correlationId: options?.correlationId})
  const response = await putEvents([entry])

  if (response.FailedEntryCount && response.FailedEntryCount > 0) {
    const failedEntry = response.Entries?.[0]
    logDebug('publishEvent failed =>', {errorCode: failedEntry?.ErrorCode, errorMessage: failedEntry?.ErrorMessage})
  }

  return response
}

/**
 * Configuration for retry behavior when publishing events.
 */
export interface PublishRetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Initial delay in milliseconds before first retry (default: 100) */
  initialDelayMs?: number
}

const DEFAULT_RETRY_CONFIG: Required<PublishRetryConfig> = {maxRetries: 3, initialDelayMs: 100}

/**
 * Custom error class for EventBridge publish failures.
 * Contains details about the failed entry for debugging.
 */
export class EventBridgePublishError extends Error {
  public readonly errorCode?: string
  public readonly errorMessage?: string

  constructor(message: string, errorCode?: string, errorMessage?: string) {
    super(message)
    this.name = 'EventBridgePublishError'
    this.errorCode = errorCode
    this.errorMessage = errorMessage
  }
}

/**
 * Publish a domain event with automatic retry on transient failures.
 *
 * Uses exponential backoff with jitter between retries. Will retry up to
 * maxRetries times (default: 3) before throwing an error.
 *
 * This is the recommended function for critical event publishing where
 * delivery is important (e.g., WebhookFeedly publishing DownloadRequested).
 *
 * @param detailType - Event type for routing (e.g., 'DownloadRequested')
 * @param detail - Event payload (will be JSON-stringified)
 * @param options - Optional correlation context for distributed tracing
 * @param retryConfig - Optional retry configuration
 * @returns PutEvents response on success
 * @throws EventBridgePublishError if all retry attempts fail
 */
export async function publishEventWithRetry<TDetail>(
  detailType: MediaDownloaderEventType,
  detail: TDetail,
  options?: PublishEventOptions,
  retryConfig?: PublishRetryConfig
): Promise<PutEventsResponse> {
  const config = {...DEFAULT_RETRY_CONFIG, ...retryConfig}
  let lastError: EventBridgePublishError | undefined

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await publishEvent(detailType, detail, options)

      // Check for partial failures - EventBridge may accept the request but fail individual entries
      if (response.FailedEntryCount && response.FailedEntryCount > 0) {
        const failedEntry = response.Entries?.[0]
        throw new EventBridgePublishError(`EventBridge publish failed: ${failedEntry?.ErrorCode} - ${failedEntry?.ErrorMessage}`, failedEntry?.ErrorCode,
          failedEntry?.ErrorMessage)
      }

      // Success - log if we had to retry
      if (attempt > 0) {
        logInfo('publishEventWithRetry succeeded after retries', {detailType, attempts: attempt + 1})
      }

      return response
    } catch (error) {
      lastError = error instanceof EventBridgePublishError
        ? error
        : new EventBridgePublishError(error instanceof Error ? error.message : String(error))

      logDebug('publishEventWithRetry attempt failed', {detailType, attempt: attempt + 1, maxRetries: config.maxRetries, error: lastError.message})

      // Don't sleep after the last attempt
      if (attempt < config.maxRetries) {
        const delay = calculateDelayWithJitter(config.initialDelayMs, attempt, 2, 5000)
        await sleep(delay)
      }
    }
  }

  // All retries exhausted
  throw lastError
}
