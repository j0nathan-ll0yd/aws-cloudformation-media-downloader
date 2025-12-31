/**
 * AWS SDK Response Factories for Unit Tests
 *
 * Provides type-safe factories for AWS SDK response objects used in mocks.
 * Use these with aws-sdk-client-mock to configure consistent mock responses.
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Vitest-Mocking-Strategy#aws-response-factories | Usage Examples}
 */

import {v4 as uuidv4} from 'uuid'

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_ACCOUNT_ID = '123456789012'
export const DEFAULT_REGION = 'us-west-2'

// ============================================================================
// SNS Response Factories
// ============================================================================

export interface SNSSubscribeResponseOptions {
  subscriptionArn?: string
  topicArn?: string
}

/**
 * Creates a mock SNS Subscribe response.
 * Used by: RegisterDevice, UserSubscribe, UserDelete, PruneDevices
 */
export function createSNSSubscribeResponse(options: SNSSubscribeResponseOptions = {}) {
  const {topicArn = `arn:aws:sns:${DEFAULT_REGION}:${DEFAULT_ACCOUNT_ID}:PushNotifications`} = options
  return {SubscriptionArn: options.subscriptionArn ?? `${topicArn}:${uuidv4()}`}
}

export interface SNSMetadataResponseOptions {
  requestId?: string
}

/**
 * Creates a mock SNS metadata-only response (for Delete/Unsubscribe commands).
 * Used by: RegisterDevice, UserSubscribe, UserDelete, PruneDevices
 */
export function createSNSMetadataResponse(options: SNSMetadataResponseOptions = {}) {
  return {$metadata: {requestId: options.requestId ?? uuidv4()}}
}

export interface SNSEndpointResponseOptions {
  endpointArn?: string
  platform?: 'APNS' | 'APNS_SANDBOX' | 'GCM'
  appName?: string
  endpointId?: string
}

/**
 * Creates a mock SNS CreatePlatformEndpoint response.
 * Used by: RegisterDevice
 */
export function createSNSEndpointResponse(options: SNSEndpointResponseOptions = {}) {
  const {
    platform = 'APNS_SANDBOX',
    appName = 'MediaDownloader',
    endpointId = uuidv4()
  } = options

  return {EndpointArn: options.endpointArn ?? `arn:aws:sns:${DEFAULT_REGION}:${DEFAULT_ACCOUNT_ID}:endpoint/${platform}/${appName}/${endpointId}`}
}

export interface SNSSubscriptionOptions {
  /** The subscription ARN */
  SubscriptionArn?: string
  /** The AWS account owner */
  Owner?: string
  /** The subscription protocol (e.g., 'application') */
  Protocol?: string
  /** The endpoint ARN that receives notifications */
  Endpoint?: string
  /** The topic ARN subscribed to */
  TopicArn?: string
}

export interface SNSSubscriptionListResponseOptions {
  subscriptions?: SNSSubscriptionOptions[]
  nextToken?: string
}

/**
 * Creates a mock SNS ListSubscriptionsByTopic response.
 * Used by: RegisterDevice
 */
export function createSNSSubscriptionListResponse(options: SNSSubscriptionListResponseOptions = {}) {
  const topicArn = `arn:aws:sns:${DEFAULT_REGION}:${DEFAULT_ACCOUNT_ID}:PushNotifications`
  const defaultEndpointArn = `arn:aws:sns:${DEFAULT_REGION}:${DEFAULT_ACCOUNT_ID}:endpoint/APNS_SANDBOX/MediaDownloader/${uuidv4()}`

  const defaultSubscription: SNSSubscriptionOptions = {
    SubscriptionArn: `${topicArn}:${uuidv4()}`,
    Owner: DEFAULT_ACCOUNT_ID,
    Protocol: 'application',
    Endpoint: defaultEndpointArn,
    TopicArn: topicArn
  }

  // Merge provided subscriptions with defaults
  const subscriptions =
    options.subscriptions?.map((sub) => ({
      SubscriptionArn: sub.SubscriptionArn ?? `${topicArn}:${uuidv4()}`,
      Owner: sub.Owner ?? DEFAULT_ACCOUNT_ID,
      Protocol: sub.Protocol ?? 'application',
      Endpoint: sub.Endpoint ?? defaultEndpointArn,
      TopicArn: sub.TopicArn ?? topicArn
    })) ?? [defaultSubscription]

  return {Subscriptions: subscriptions, NextToken: options.nextToken}
}

export interface SNSPublishResponseOptions {
  messageId?: string
}

/**
 * Creates a mock SNS Publish response.
 * Used by: SendPushNotification
 */
export function createSNSPublishResponse(options: SNSPublishResponseOptions = {}) {
  return {MessageId: options.messageId ?? uuidv4()}
}

// ============================================================================
// SQS Response Factories
// ============================================================================

export interface SQSSendMessageResponseOptions {
  messageId?: string
  sequenceNumber?: string
}

/**
 * Creates a mock SQS SendMessage response.
 * Used by: StartFileUpload, WebhookFeedly, S3ObjectCreated
 */
export function createSQSSendMessageResponse(options: SQSSendMessageResponseOptions = {}) {
  return {MessageId: options.messageId ?? `msg-${uuidv4().slice(0, 8)}`}
}

// ============================================================================
// EventBridge Response Factories
// ============================================================================

export interface EventBridgeEntryOptions {
  eventId?: string
  errorCode?: string
  errorMessage?: string
}

export interface EventBridgePutEventsResponseOptions {
  failedEntryCount?: number
  entries?: EventBridgeEntryOptions[]
}

/**
 * Creates a mock EventBridge PutEvents response.
 * Used by: StartFileUpload, WebhookFeedly
 */
export function createEventBridgePutEventsResponse(options: EventBridgePutEventsResponseOptions = {}) {
  const {failedEntryCount = 0, entries} = options

  const defaultEntries: EventBridgeEntryOptions[] = entries ?? [{eventId: `event-${uuidv4().slice(0, 8)}`}]

  return {
    FailedEntryCount: failedEntryCount,
    Entries: defaultEntries.map((entry) => ({
      EventId: entry.eventId ?? `event-${uuidv4().slice(0, 8)}`,
      ...(entry.errorCode && {ErrorCode: entry.errorCode}),
      ...(entry.errorMessage && {ErrorMessage: entry.errorMessage})
    }))
  }
}

/**
 * Creates a failed EventBridge PutEvents response for error testing.
 */
export function createEventBridgePutEventsFailureResponse(errorMessage = 'EventBridge failure') {
  return createEventBridgePutEventsResponse({failedEntryCount: 1, entries: [{errorCode: 'InternalError', errorMessage}]})
}

// ============================================================================
// API Gateway Response Factories
// ============================================================================

export interface GetApiKeysResponseOptions {
  /** API key value (the secret key string) */
  value?: string
  /** Whether the API key is enabled */
  enabled?: boolean
  /** API key ID */
  id?: string
  /** API key name */
  name?: string
}

/**
 * Creates a mock GetApiKeys response for testing API key validation.
 * Used by: ApiGatewayAuthorizer
 *
 * @example
 * ```ts
 * // Default response with custom key value
 * const response = createGetApiKeysResponse({value: myApiKey})
 *
 * // Disabled API key for error testing
 * const disabledResponse = createGetApiKeysResponse({value: myApiKey, enabled: false})
 * ```
 */
export function createGetApiKeysResponse(options: GetApiKeysResponseOptions = {}) {
  const {value = 'test-api-key-value', enabled = true, id = 'meptp2mf8d', name = 'iOSAppKey'} = options

  return {
    items: [
      {
        id,
        value,
        name,
        description: 'The key for the iOS App',
        enabled,
        createdDate: '2022-07-31T21:23:55.000Z',
        lastUpdatedDate: '2022-07-31T21:23:55.000Z',
        stageKeys: []
      }
    ]
  }
}

export interface GetUsagePlansResponseOptions {
  /** Usage plan ID */
  id?: string
  /** Usage plan name */
  name?: string
  /** API ID for the stage */
  apiId?: string
  /** Stage name */
  stage?: string
}

/**
 * Creates a mock GetUsagePlans response for testing usage plan lookup.
 * Used by: ApiGatewayAuthorizer
 */
export function createGetUsagePlansResponse(options: GetUsagePlansResponseOptions = {}) {
  const {id = 'ccibr9', name = 'iOSApp', apiId = 'naf24gu6t6', stage = 'prod'} = options

  return {
    items: [
      {id, name, description: 'Internal consumption', apiStages: [{apiId, stage}]}
    ]
  }
}

export interface GetUsageResponseOptions {
  /** Usage plan ID */
  usagePlanId?: string
  /** API key ID for usage data */
  apiKeyId?: string
  /** Usage data as [used, remaining] tuple */
  usage?: [number, number]
}

/**
 * Creates a mock GetUsage response for testing usage quota checks.
 * Used by: ApiGatewayAuthorizer
 */
export function createGetUsageResponse(options: GetUsageResponseOptions = {}) {
  const {usagePlanId = 'ccibr9', apiKeyId = 'meptp2mf8d', usage = [0, 0]} = options

  return {usagePlanId, startDate: '2022-10-08', endDate: '2022-10-08', items: {[apiKeyId]: [usage]}}
}
