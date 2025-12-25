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
import {logDebug} from '#lib/system/logging'
import type {MediaDownloaderEventType} from '#types/events'

const eventBridge = createEventBridgeClient()

export type {PutEventsRequestEntry, PutEventsResponse}

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
 * Publish a single domain event to the MediaDownloader event bus.
 *
 * Constructs the EventBridge envelope with standard source and bus name,
 * then publishes the event. Returns the response for error handling.
 *
 * @param detailType - Event type for routing (e.g., 'DownloadRequested')
 * @param detail - Event payload (will be JSON-stringified)
 * @returns PutEvents response
 * @throws Error if EVENT_BUS_NAME environment variable is not set
 *
 * @example
 * ```typescript
 * await publishEvent('DownloadRequested', {
 *   fileId: 'abc123',
 *   userId: 'user-1',
 *   sourceUrl: 'https://youtube.com/...',
 *   correlationId: 'corr-1',
 *   requestedAt: new Date().toISOString()
 * })
 * ```
 */
export async function publishEvent<TDetail>(detailType: MediaDownloaderEventType, detail: TDetail): Promise<PutEventsResponse> {
  const eventBusName = getRequiredEnv('EVENT_BUS_NAME')

  const entry: PutEventsRequestEntry = {
    EventBusName: eventBusName,
    Source: 'media-downloader',
    DetailType: detailType,
    Detail: JSON.stringify(detail),
    Time: new Date()
  }

  logDebug('publishEvent <=', {detailType, eventBusName})
  const response = await putEvents([entry])

  if (response.FailedEntryCount && response.FailedEntryCount > 0) {
    const failedEntry = response.Entries?.[0]
    logDebug('publishEvent failed =>', {errorCode: failedEntry?.ErrorCode, errorMessage: failedEntry?.ErrorMessage})
  }

  return response
}
