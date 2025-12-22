import {PutEventsCommand} from '@aws-sdk/client-eventbridge'
import type {PutEventsCommandInput, PutEventsRequestEntry, PutEventsResultEntry} from '@aws-sdk/client-eventbridge'
import {createEventBridgeClient} from './clients'

const eventBridge = createEventBridgeClient()

export type {PutEventsCommandInput, PutEventsRequestEntry, PutEventsResultEntry}

/**
 * Event types for the media-downloader event bus
 */
export enum EventType {
  DownloadRequested = 'DownloadRequested',
  DownloadCompleted = 'DownloadCompleted',
  DownloadFailed = 'DownloadFailed'
}

/**
 * Base interface for all events
 */
interface BaseEvent {
  fileId: string
  correlationId?: string
  userId?: string
}

/**
 * DownloadRequested event - published by WebhookFeedly/API when new download is requested
 */
export interface DownloadRequestedEvent extends BaseEvent {
  sourceUrl: string
  backgroundMode?: boolean
}

/**
 * DownloadCompleted event - published by StartFileUpload when download succeeds
 */
export interface DownloadCompletedEvent extends BaseEvent {
  fileSize: number
  duration: number
  s3Key: string
}

/**
 * DownloadFailed event - published by StartFileUpload when download permanently fails
 */
export interface DownloadFailedEvent extends BaseEvent {
  error: string
  category: string
  retryCount?: number
}

/**
 * Publish an event to the media-downloader event bus
 */
export async function publishEvent(
  eventType: EventType,
  detail: DownloadRequestedEvent | DownloadCompletedEvent | DownloadFailedEvent
): Promise<PutEventsResultEntry[]> {
  const params: PutEventsCommandInput = {
    Entries: [
      {
        Source: 'media-downloader',
        DetailType: eventType,
        Detail: JSON.stringify(detail),
        EventBusName: 'media-downloader'
      }
    ]
  }

  const command = new PutEventsCommand(params)
  const response = await eventBridge.send(command)

  if (response.FailedEntryCount && response.FailedEntryCount > 0) {
    throw new Error(`Failed to publish event: ${JSON.stringify(response.Entries)}`)
  }

  return response.Entries || []
}
