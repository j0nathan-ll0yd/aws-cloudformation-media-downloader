/**
 * EventBridge Event Type Definitions
 *
 * These types define the structure of events published to the MediaDownloaderEvents bus.
 * All events are archived for 90 days and can be replayed for debugging.
 */

/**
 * Event published when a Feedly webhook is received
 */
export interface FileWebhookReceivedEvent {
  fileId: string
  userId: string
  timestamp: string
  source: 'feedly' | 'api' | 'manual'
  backgroundMode?: boolean
  articleTitle?: string
  articleUrl?: string
}

/**
 * Event published when a file download is initiated
 */
export interface FileDownloadInitiatedEvent {
  fileId: string
  timestamp: string
  status: 'PendingDownload' | 'InProgress'
  initiatedBy: 'step-functions' | 'webhook' | 'manual'
  metadata?: {
    title?: string
    authorName?: string
    size?: number
  }
}

/**
 * Event published when a file is successfully uploaded to S3
 */
export interface FileUploadedEvent {
  fileId: string
  key: string
  bucket: string
  timestamp: string
  size: number
  contentType?: string
  publishDate?: string
}

/**
 * Event published when a push notification is queued for delivery
 */
export interface NotificationQueuedEvent {
  fileId: string
  userIds: string[]
  timestamp: string
  notificationType: 'FileNotification'
}

/**
 * Event published when a file download fails
 */
export interface FileDownloadFailedEvent {
  fileId: string
  timestamp: string
  error: {
    name: string
    message: string
    stack?: string
  }
  retryCount?: number
}

/**
 * Event published when the FileCoordinator state machine encounters an error
 */
export interface FileCoordinatorErrorEvent {
  timestamp: string
  error: {
    name: string
    message: string
  }
  executionArn?: string
}

/**
 * Union type for all MediaDownloader events
 */
export type MediaDownloaderEvent =
  | FileWebhookReceivedEvent
  | FileDownloadInitiatedEvent
  | FileUploadedEvent
  | NotificationQueuedEvent
  | FileDownloadFailedEvent
  | FileCoordinatorErrorEvent

/**
 * Event detail types (used in EventBridge DetailType field)
 */
export type EventDetailType =
  | 'FileWebhookReceived'
  | 'FileDownloadInitiated'
  | 'FileUploaded'
  | 'NotificationQueued'
  | 'FileDownloadFailed'
  | 'FileCoordinatorError'
