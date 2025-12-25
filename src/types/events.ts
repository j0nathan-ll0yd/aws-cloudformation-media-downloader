/**
 * EventBridge Event Types
 *
 * Domain events published to the MediaDownloader EventBridge event bus.
 * These events enable loose coupling between Lambdas via event-driven architecture.
 *
 * Event Flow:
 * 1. WebhookFeedly publishes DownloadRequested
 * 2. EventBridge routes to DownloadQueue (SQS)
 * 3. StartFileUpload consumes from SQS, publishes DownloadCompleted/DownloadFailed
 *
 * @see terraform/eventbridge.tf for routing rules
 * @see terraform/download_queue.tf for SQS configuration
 */

/**
 * Event types for routing in EventBridge rules.
 *
 * These match the `detail-type` field in EventBridge events.
 */
export type MediaDownloaderEventType = 'DownloadRequested' | 'DownloadCompleted' | 'DownloadFailed'

/**
 * Detail payload for DownloadRequested event.
 *
 * Published by WebhookFeedly when a user requests a new video download.
 * Routed by EventBridge to the DownloadQueue for processing.
 *
 * @see WebhookFeedly Lambda for producer
 * @see StartFileUpload Lambda for consumer
 */
export interface DownloadRequestedDetail {
  /** YouTube video ID (e.g., 'dQw4w9WgXcQ') */
  fileId: string
  /** User ID who requested the download */
  userId: string
  /** Original YouTube URL */
  sourceUrl: string
  /** Correlation ID for end-to-end request tracing */
  correlationId: string
  /** ISO 8601 timestamp when request was received */
  requestedAt: string
}

/**
 * Detail payload for DownloadCompleted event.
 *
 * Published by StartFileUpload after successful download to S3.
 * Can trigger downstream notifications or sync operations.
 *
 * @see StartFileUpload Lambda for producer
 */
export interface DownloadCompletedDetail {
  /** YouTube video ID */
  fileId: string
  /** Correlation ID for end-to-end request tracing */
  correlationId: string
  /** S3 object key (e.g., 'dQw4w9WgXcQ.mp4') */
  s3Key: string
  /** File size in bytes */
  fileSize: number
  /** ISO 8601 timestamp when download completed */
  completedAt: string
}

/**
 * Detail payload for DownloadFailed event.
 *
 * Published by StartFileUpload when download fails.
 * Used for observability and user notification.
 *
 * @see StartFileUpload Lambda for producer
 * @see classifyVideoError for error categorization
 */
export interface DownloadFailedDetail {
  /** YouTube video ID */
  fileId: string
  /** Correlation ID for end-to-end request tracing */
  correlationId: string
  /** Error category (e.g., 'cookie_expired', 'video_unavailable') */
  errorCategory: string
  /** Human-readable error message */
  errorMessage: string
  /** Whether the error is retryable */
  retryable: boolean
  /** Current retry attempt number */
  retryCount: number
  /** ISO 8601 timestamp when failure occurred */
  failedAt: string
}

/**
 * SQS message structure for DownloadQueue.
 *
 * This is the transformed payload that arrives in SQS after EventBridge
 * routes DownloadRequested events. The input_transformer in EventBridge
 * extracts and flattens the detail fields.
 *
 * @see terraform/eventbridge.tf for input_transformer configuration
 * @see StartFileUpload Lambda for consumer
 */
export interface DownloadQueueMessage {
  /** YouTube video ID */
  fileId: string
  /** Original YouTube URL */
  sourceUrl: string
  /** Correlation ID for end-to-end request tracing */
  correlationId: string
  /** User ID who requested the download */
  userId: string
  /** Retry attempt number (starts at 1, incremented by SQS on retry) */
  attempt: number
}
