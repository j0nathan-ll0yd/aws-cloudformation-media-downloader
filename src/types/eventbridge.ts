/**
 * TypeScript type definitions for EventBridge events
 * Generated from EventBridge Schema Registry definitions
 * @module types/eventbridge
 */

/**
 * Base structure for all EventBridge events
 */
export interface EventBridgeEvent<TDetail = unknown> {
  version: string
  id: string
  'detail-type': string
  source: string
  account: string
  time: string
  region: string
  resources: string[]
  detail: TDetail
}

/**
 * Detail payload for FileMetadataReady event
 * Published when video metadata has been retrieved
 */
export interface FileMetadataReadyDetail {
  fileId: string
  title: string
  description: string
  authorName: string
  authorUser: string
  publishDate: string
  contentType: string
  size: number
}

/**
 * FileMetadataReady event
 * Published when video metadata is ready for download
 */
export interface FileMetadataReadyEvent extends EventBridgeEvent<FileMetadataReadyDetail> {
  'detail-type': 'FileMetadataReady'
  source: 'aws.mediadownloader.metadata'
}

/**
 * Detail payload for FileDownloadStarted event
 */
export interface FileDownloadStartedDetail {
  fileId: string
  timestamp: number
}

/**
 * FileDownloadStarted event
 * Published when file download begins
 */
export interface FileDownloadStartedEvent extends EventBridgeEvent<FileDownloadStartedDetail> {
  'detail-type': 'FileDownloadStarted'
  source: 'aws.mediadownloader.download'
}

/**
 * Detail payload for FileDownloadCompleted event
 */
export interface FileDownloadCompletedDetail {
  fileId: string
  s3Key: string
  s3Url?: string
  size: number
  contentType: string
}

/**
 * FileDownloadCompleted event
 * Published when file is successfully uploaded to S3
 */
export interface FileDownloadCompletedEvent extends EventBridgeEvent<FileDownloadCompletedDetail> {
  'detail-type': 'FileDownloadCompleted'
  source: 'aws.mediadownloader.download'
}

/**
 * Detail payload for FileDownloadFailed event
 */
export interface FileDownloadFailedDetail {
  fileId: string
  error: string
  errorCode?: string
  timestamp: number
}

/**
 * FileDownloadFailed event
 * Published when download fails
 */
export interface FileDownloadFailedEvent extends EventBridgeEvent<FileDownloadFailedDetail> {
  'detail-type': 'FileDownloadFailed'
  source: 'aws.mediadownloader.download'
}

/**
 * Union type of all media downloader events
 */
export type MediaDownloaderEvent =
  | FileMetadataReadyEvent
  | FileDownloadStartedEvent
  | FileDownloadCompletedEvent
  | FileDownloadFailedEvent
