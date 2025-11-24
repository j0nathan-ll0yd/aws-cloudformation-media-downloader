/**
 * EventBridge Event Publishing Utilities
 *
 * Helper functions for publishing events to the custom EventBridge bus.
 * Follows type-safe event schemas and conventions.
 *
 * @module util/eventbridge-helpers
 */

import {putEvents, PutEventsRequestEntry} from '../lib/vendor/AWS/EventBridge'
import {
  FileMetadataReadyDetail,
  FileDownloadStartedDetail,
  FileDownloadCompletedDetail,
  FileDownloadFailedDetail
} from '../types/eventbridge'
import {logDebug, logError} from './lambda-helpers'

const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || 'MediaDownloaderEvents'

/**
 * Publish a FileMetadataReady event to EventBridge
 *
 * @param detail - Event detail payload
 * @returns Promise resolving to PutEvents response
 *
 * @example
 * ```typescript
 * await publishFileMetadataReady({
 *   fileId: 'abc123',
 *   title: 'Video Title',
 *   contentType: 'video/mp4',
 *   size: 1048576,
 *   authorName: 'Channel Name',
 *   authorUser: 'channeluser',
 *   publishDate: '2025-01-01T00:00:00Z',
 *   description: 'Video description'
 * })
 * ```
 */
export async function publishFileMetadataReady(detail: FileMetadataReadyDetail) {
  const entry: PutEventsRequestEntry = {
    Source: 'aws.mediadownloader.metadata',
    DetailType: 'FileMetadataReady',
    Detail: JSON.stringify(detail),
    EventBusName: EVENT_BUS_NAME
  }

  logDebug('publishFileMetadataReady <=', entry)

  try {
    const response = await putEvents({Entries: [entry]})
    logDebug('publishFileMetadataReady =>', response)
    return response
  } catch (error) {
    logError(error, {context: 'publishFileMetadataReady', detail})
    throw error
  }
}

/**
 * Publish a FileDownloadStarted event to EventBridge
 *
 * @param detail - Event detail payload
 * @returns Promise resolving to PutEvents response
 */
export async function publishFileDownloadStarted(detail: FileDownloadStartedDetail) {
  const entry: PutEventsRequestEntry = {
    Source: 'aws.mediadownloader.download',
    DetailType: 'FileDownloadStarted',
    Detail: JSON.stringify(detail),
    EventBusName: EVENT_BUS_NAME
  }

  logDebug('publishFileDownloadStarted <=', entry)

  try {
    const response = await putEvents({Entries: [entry]})
    logDebug('publishFileDownloadStarted =>', response)
    return response
  } catch (error) {
    logError(error, {context: 'publishFileDownloadStarted', detail})
    throw error
  }
}

/**
 * Publish a FileDownloadCompleted event to EventBridge
 *
 * @param detail - Event detail payload
 * @returns Promise resolving to PutEvents response
 *
 * @example
 * ```typescript
 * await publishFileDownloadCompleted({
 *   fileId: 'abc123',
 *   s3Key: 'videos/abc123.mp4',
 *   s3Url: 'https://...',
 *   size: 1048576,
 *   contentType: 'video/mp4'
 * })
 * ```
 */
export async function publishFileDownloadCompleted(detail: FileDownloadCompletedDetail) {
  const entry: PutEventsRequestEntry = {
    Source: 'aws.mediadownloader.download',
    DetailType: 'FileDownloadCompleted',
    Detail: JSON.stringify(detail),
    EventBusName: EVENT_BUS_NAME
  }

  logDebug('publishFileDownloadCompleted <=', entry)

  try {
    const response = await putEvents({Entries: [entry]})
    logDebug('publishFileDownloadCompleted =>', response)
    return response
  } catch (error) {
    logError(error, {context: 'publishFileDownloadCompleted', detail})
    throw error
  }
}

/**
 * Publish a FileDownloadFailed event to EventBridge
 *
 * @param detail - Event detail payload
 * @returns Promise resolving to PutEvents response
 *
 * @example
 * ```typescript
 * await publishFileDownloadFailed({
 *   fileId: 'abc123',
 *   error: 'Download timeout',
 *   errorCode: 'TIMEOUT',
 *   timestamp: Date.now()
 * })
 * ```
 */
export async function publishFileDownloadFailed(detail: FileDownloadFailedDetail) {
  const entry: PutEventsRequestEntry = {
    Source: 'aws.mediadownloader.download',
    DetailType: 'FileDownloadFailed',
    Detail: JSON.stringify(detail),
    EventBusName: EVENT_BUS_NAME
  }

  logDebug('publishFileDownloadFailed <=', entry)

  try {
    const response = await putEvents({Entries: [entry]})
    logDebug('publishFileDownloadFailed =>', response)
    return response
  } catch (error) {
    logError(error, {context: 'publishFileDownloadFailed', detail})
    throw error
  }
}
