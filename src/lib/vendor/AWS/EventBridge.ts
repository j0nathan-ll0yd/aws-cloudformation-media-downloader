/**
 * AWS EventBridge Vendor Wrapper
 *
 * Encapsulates AWS SDK EventBridge operations following the AWS SDK Encapsulation Policy.
 * All EventBridge interactions must go through this module.
 *
 * @module lib/vendor/AWS/EventBridge
 */

import {PutEventsCommand, PutEventsInput, PutEventsResponse, PutEventsRequestEntry} from '@aws-sdk/client-eventbridge'
import {createEventBridgeClient} from './clients'

const eventBridgeClient = createEventBridgeClient()

// Re-export types for application code to use
export type {PutEventsInput, PutEventsResponse, PutEventsRequestEntry}

/**
 * Put custom events to EventBridge
 * Supports both default and custom event buses
 *
 * @param params - PutEvents parameters including event entries
 * @returns Promise resolving to PutEventsResponse
 *
 * @example
 * ```typescript
 * import {putEvents} from '../../../lib/vendor/AWS/EventBridge'
 *
 * await putEvents({
 *   Entries: [{
 *     Source: 'aws.mediadownloader.download',
 *     DetailType: 'FileDownloadCompleted',
 *     Detail: JSON.stringify({fileId: 'abc123', size: 1024}),
 *     EventBusName: 'MediaDownloaderEvents'
 *   }]
 * })
 * ```
 */
/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function putEvents(params: PutEventsInput): Promise<PutEventsResponse> {
  const command = new PutEventsCommand(params)
  return eventBridgeClient.send(command)
}
/* c8 ignore stop */
