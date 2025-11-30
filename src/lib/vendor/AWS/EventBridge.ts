import {PutEventsCommand, PutEventsCommandInput, PutEventsCommandOutput, PutEventsRequestEntry} from '@aws-sdk/client-eventbridge'
import {createEventBridgeClient} from './clients'
import {getRequiredEnv} from '#util/env-validation'

const eventbridge = createEventBridgeClient()

// Re-export types for application code to use
export type {PutEventsCommandInput, PutEventsCommandOutput, PutEventsRequestEntry}

/**
 * Publishes events to EventBridge
 * @param params - The PutEvents parameters
 * @returns The PutEvents response
 */
/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function putEvents(params: PutEventsCommandInput): Promise<PutEventsCommandOutput> {
  const command = new PutEventsCommand(params)
  return eventbridge.send(command)
}
/* c8 ignore stop */

/**
 * Helper to publish a single event to the MediaDownloaderEvents bus
 * @param detailType - The event type (e.g., 'FileUploaded', 'FileWebhookReceived')
 * @param detail - The event payload
 * @param source - The event source (defaults to 'media-downloader')
 * @returns The PutEvents response
 */
export async function publishEvent<T extends object>(
  detailType: string,
  detail: T,
  source: string = 'media-downloader'
): Promise<PutEventsCommandOutput> {
  const eventBusName = getRequiredEnv('EventBusName')

  return putEvents({
    Entries: [
      {
        EventBusName: eventBusName,
        Source: source,
        DetailType: detailType,
        Detail: JSON.stringify(detail),
        Time: new Date()
      }
    ]
  })
}

/**
 * Helper to publish multiple events to the MediaDownloaderEvents bus
 * @param events - Array of events to publish
 * @returns The PutEvents response
 */
export async function publishEvents(
  events: Array<{detailType: string; detail: object; source?: string}>
): Promise<PutEventsCommandOutput> {
  const eventBusName = getRequiredEnv('EventBusName')
  const now = new Date()

  const entries: PutEventsRequestEntry[] = events.map((event) => ({
    EventBusName: eventBusName,
    Source: event.source ?? 'media-downloader',
    DetailType: event.detailType,
    Detail: JSON.stringify(event.detail),
    Time: now
  }))

  return putEvents({Entries: entries})
}
