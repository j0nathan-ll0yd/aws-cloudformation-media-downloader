import {PutEventsCommand} from '@aws-sdk/client-eventbridge'
import type {PutEventsCommandInput, PutEventsRequestEntry, PutEventsResultEntry} from '@aws-sdk/client-eventbridge'
import {createEventBridgeClient} from './clients'

const eventBridge = createEventBridgeClient()

export type { PutEventsCommandInput, PutEventsRequestEntry, PutEventsResultEntry }

/**
 * Event types for the media-downloader event bus
 */
export enum EventType {
  DownloadRequested = 'DownloadRequested',
  DownloadCompleted = 'DownloadCompleted',
  DownloadFailed = 'DownloadFailed',
  FileUploaded = 'FileUploaded'
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
 * FileUploaded event - published by S3ObjectCreated when file upload completes
 */
export interface FileUploadedEvent extends BaseEvent {
  s3Key: string
  fileSize: number
  contentType: string
}

/**
 * Union type for all download-related events
 */
export type DownloadEvent = DownloadRequestedEvent | DownloadCompletedEvent | DownloadFailedEvent | FileUploadedEvent

/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
/**
 * Publish an event to the media-downloader event bus
 *
 * Note: This is a pure pass-through wrapper. Callers should check
 * PutEventsResultEntry[] for ErrorCode fields to handle partial failures.
 */
export async function publishEvent(eventType: EventType, detail: DownloadEvent): Promise<PutEventsResultEntry[]> {
  const params: PutEventsCommandInput = {
    Entries: [
      {Source: 'media-downloader', DetailType: eventType, Detail: JSON.stringify(detail), EventBusName: 'media-downloader'}
    ]
  }

  const command = new PutEventsCommand(params)
  const response = await eventBridge.send(command)

  return response.Entries || []
}
/* c8 ignore stop */
