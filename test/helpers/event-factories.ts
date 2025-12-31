/**
 * Typed Event Factories for Unit Tests
 *
 * Provides composable, type-safe factories for AWS Lambda events.
 * Replaces JSON fixture imports with programmatic event creation.
 *
 * Usage:
 * ```typescript
 * import {createAPIGatewayEvent, createSQSEvent, createS3Event} from '#test/helpers/event-factories'
 *
 * const event = createAPIGatewayEvent({
 *   path: '/registerDevice',
 *   httpMethod: 'POST',
 *   body: JSON.stringify({token: 'test-token', deviceId: 'device-123'})
 * })
 * ```
 *
 * @see test/integration/helpers/test-data.ts for integration test factories
 */

import type {S3Event, S3EventRecord, ScheduledEvent, SQSEvent, SQSRecord} from 'aws-lambda'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'

/**
 * Default values for consistent test data
 */
export const DEFAULT_USER_ID = 'abcdefgh-ijkl-mnop-qrst-uvwxyz123456'
export const DEFAULT_API_KEY = 'test-api-key-abc123'
export const DEFAULT_REGION = 'us-west-2'
export const DEFAULT_ACCOUNT_ID = '123456789012'

// ============================================================================
// API Gateway Events
// ============================================================================

export interface APIGatewayEventOptions {
  /** HTTP method (GET, POST, etc.) */
  httpMethod?: string
  /** Request path (e.g., '/registerDevice') */
  path?: string
  /** Request body (string or null) */
  body?: string | null
  /** HTTP headers */
  headers?: Record<string, string>
  /** User ID from authorizer (sets principalId and userId) */
  userId?: string
  /** Whether user is authenticated (true), anonymous (false), or unauthenticated (undefined) */
  isAuthenticated?: boolean
  /** Query string parameters */
  queryStringParameters?: Record<string, string> | null
  /** Path parameters */
  pathParameters?: Record<string, string> | null
}

/**
 * Creates a mock API Gateway event with authorizer context.
 * Primary event type for authenticated Lambda handlers.
 * Supports authenticated, anonymous, and unauthenticated users.
 */
export function createAPIGatewayEvent(options: APIGatewayEventOptions = {}): CustomAPIGatewayRequestAuthorizerEvent {
  const {
    httpMethod = 'GET',
    path = '/test',
    body = null,
    headers = {},
    userId,
    isAuthenticated = userId !== undefined,
    queryStringParameters = null,
    pathParameters = null
  } = options

  // Determine principalId based on authentication state
  const principalId = userId ?? (isAuthenticated ? DEFAULT_USER_ID : 'unknown')

  // Build headers - always include Authorization by default
  // Tests can delete it for anonymous scenarios: delete event.headers['Authorization']
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'MediaDownloader/1.0 iOS/17.0',
    'Authorization': 'Bearer test-token'
  }

  return {
    resource: path,
    path,
    httpMethod,
    headers: {...defaultHeaders, ...headers},
    multiValueHeaders: {},
    queryStringParameters,
    multiValueQueryStringParameters: null,
    pathParameters,
    stageVariables: null,
    requestContext: {
      resourceId: 'test-resource',
      authorizer: {
        principalId,
        userId: isAuthenticated ? userId : undefined,
        userStatus: isAuthenticated ? 0 : undefined,
        integrationLatency: 100
      },
      resourcePath: path,
      httpMethod,
      extendedRequestId: 'test-extended-request-id',
      requestTime: new Date().toISOString(),
      path: `/prod${path}`,
      accountId: DEFAULT_ACCOUNT_ID,
      protocol: 'HTTP/1.1',
      stage: 'prod',
      domainPrefix: 'api',
      requestTimeEpoch: Date.now(),
      requestId: `request-${Date.now()}`,
      identity: {
        cognitoIdentityPoolId: null,
        cognitoIdentityId: null,
        apiKey: DEFAULT_API_KEY,
        principalOrgId: null,
        cognitoAuthenticationType: null,
        userArn: null,
        apiKeyId: 'test-api-key-id',
        userAgent: 'MediaDownloader/1.0 iOS/17.0',
        accountId: null,
        caller: null,
        sourceIp: '127.0.0.1',
        accessKey: null,
        cognitoAuthenticationProvider: null,
        user: null
      },
      domainName: 'api.example.com',
      apiId: 'test-api-id'
    },
    body,
    isBase64Encoded: false
  } as CustomAPIGatewayRequestAuthorizerEvent
}

// ============================================================================
// SQS Events
// ============================================================================

export interface SQSRecordOptions {
  /** Unique message ID */
  messageId?: string
  /** Message body (will be JSON stringified if object) */
  body: string | Record<string, unknown>
  /** Message attributes */
  messageAttributes?: Record<string, {stringValue: string; dataType: string}>
  /** Queue ARN suffix (e.g., 'SendPushNotification') */
  queueName?: string
}

export interface SQSEventOptions {
  /** Array of SQS records */
  records?: SQSRecordOptions[]
}

/**
 * Creates a single SQS record.
 */
function createSQSRecord(options: SQSRecordOptions): SQSRecord {
  const {
    messageId = `msg-${Date.now()}`,
    body,
    messageAttributes = {},
    queueName = 'TestQueue'
  } = options

  const bodyString = typeof body === 'string' ? body : JSON.stringify(body)

  return {
    messageId,
    receiptHandle: `receipt-${messageId}`,
    body: bodyString,
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: String(Date.now()),
      SenderId: 'AIDAIT2UOQQY3AUEKVGXU',
      ApproximateFirstReceiveTimestamp: String(Date.now())
    },
    messageAttributes: Object.fromEntries(
      Object.entries(messageAttributes).map(([key, value]) => [
        key,
        {...value, stringListValues: [], binaryListValues: []}
      ])
    ),
    md5OfBody: 'test-md5',
    eventSource: 'aws:sqs',
    eventSourceARN: `arn:aws:sqs:${DEFAULT_REGION}:${DEFAULT_ACCOUNT_ID}:${queueName}`,
    awsRegion: DEFAULT_REGION
  }
}

/** Creates an SQS event with one or more records. */
export function createSQSEvent(options: SQSEventOptions = {}): SQSEvent {
  const {records = [{body: {}}]} = options
  return {Records: records.map(createSQSRecord)}
}

/** Creates an SQS event for the DownloadQueue (StartFileUpload consumer). */
export function createDownloadQueueEvent(
  fileId: string,
  options?: {messageId?: string; sourceUrl?: string; correlationId?: string; userId?: string; attempt?: number}
): SQSEvent {
  const {
    messageId = `msg-${fileId}`,
    sourceUrl = `https://www.youtube.com/watch?v=${fileId}`,
    correlationId = `corr-${fileId}`,
    userId = 'test-user',
    attempt = 1
  } = options ?? {}

  return createSQSEvent({
    records: [{
      messageId,
      body: {fileId, sourceUrl, correlationId, userId, attempt},
      queueName: 'DownloadQueue'
    }]
  })
}

/** Creates an SQS event for SendPushNotification (DownloadReadyNotification). */
export function createPushNotificationEvent(
  userId: string,
  fileId: string,
  options?: {title?: string; size?: number; url?: string; key?: string}
): SQSEvent {
  const {
    title = 'Test Video Title',
    size = 62928924,
    url = `https://example.cloudfront.net/${fileId}.mp4`,
    key = `${fileId}.mp4`
  } = options ?? {}

  return createSQSEvent({
    records: [{
      messageId: `msg-${fileId}`,
      body: {
        notificationType: 'DownloadReadyNotification',
        file: {fileId, key, size, url}
      },
      messageAttributes: {
        notificationType: {stringValue: 'DownloadReadyNotification', dataType: 'String'},
        userId: {stringValue: userId, dataType: 'String'},
        fileId: {stringValue: fileId, dataType: 'String'},
        key: {stringValue: key, dataType: 'String'},
        size: {stringValue: String(size), dataType: 'Number'},
        url: {stringValue: url, dataType: 'String'},
        title: {stringValue: title, dataType: 'String'},
        publishDate: {stringValue: new Date().toISOString(), dataType: 'String'}
      },
      queueName: 'SendPushNotification'
    }]
  })
}

// ============================================================================
// S3 Events
// ============================================================================

export interface S3RecordOptions {
  /** S3 object key (will be URL-encoded in the event) */
  key: string
  /** Bucket name */
  bucket?: string
  /** Object size in bytes */
  size?: number
  /** Event type */
  eventName?: string
}

export interface S3EventOptions {
  /** Array of S3 records */
  records?: S3RecordOptions[]
}

/**
 * Creates a single S3 event record.
 */
function createS3Record(options: S3RecordOptions): S3EventRecord {
  const {
    key,
    bucket = 'test-bucket',
    size = 51839177,
    eventName = 'ObjectCreated:Put'
  } = options

  return {
    eventVersion: '2.1',
    eventSource: 'aws:s3',
    awsRegion: DEFAULT_REGION,
    eventTime: new Date().toISOString(),
    eventName,
    userIdentity: {principalId: 'EXAMPLE'},
    requestParameters: {sourceIPAddress: '127.0.0.1'},
    responseElements: {'x-amz-request-id': 'test-request-id', 'x-amz-id-2': 'test-id-2'},
    s3: {
      s3SchemaVersion: '1.0',
      configurationId: 'test-config',
      bucket: {
        name: bucket,
        ownerIdentity: {principalId: 'EXAMPLE'},
        arn: `arn:aws:s3:::${bucket}`
      },
      object: {
        key: encodeURIComponent(key),
        size,
        eTag: 'test-etag',
        sequencer: '123456789'
      }
    }
  }
}

/** Creates an S3 event with one or more records. */
export function createS3Event(options: S3EventOptions = {}): S3Event {
  const {records = [{key: 'test-file.mp4'}]} = options
  return {Records: records.map(createS3Record)}
}

// ============================================================================
// Scheduled Events (CloudWatch/EventBridge)
// ============================================================================

export interface ScheduledEventOptions {
  /** Event ID */
  id?: string
  /** Rule name */
  ruleName?: string
  /** Event detail (payload) */
  detail?: Record<string, unknown>
}

/** Creates a CloudWatch Events / EventBridge scheduled event. */
export function createScheduledEvent(options: ScheduledEventOptions = {}): ScheduledEvent {
  const {
    id = `event-${Date.now()}`,
    ruleName = 'ScheduledEvent',
    detail = {}
  } = options

  return {
    id,
    version: '0',
    account: DEFAULT_ACCOUNT_ID,
    'detail-type': 'Scheduled Event',
    source: 'aws.events',
    time: new Date().toISOString(),
    region: DEFAULT_REGION,
    resources: [`arn:aws:events:${DEFAULT_REGION}:${DEFAULT_ACCOUNT_ID}:rule/${ruleName}`],
    detail
  }
}

// ============================================================================
// Request Body Helpers
// ============================================================================

/**
 * Creates a RegisterDevice request body.
 */
export function createRegisterDeviceBody(options?: {
  token?: string
  deviceId?: string
  systemVersion?: string
  systemName?: string
  name?: string
}): string {
  return JSON.stringify({
    token: options?.token ?? '1270ac093113154918d1ae96e90247d068b98766842654b3cc2400c7342dc4ba',
    deviceId: options?.deviceId ?? '67C431DE-37D2-4BBA-9055-E9D2766517E1',
    systemVersion: options?.systemVersion ?? '17.0',
    systemName: options?.systemName ?? 'iOS',
    name: options?.name ?? 'Test iPhone'
  })
}

/**
 * Creates a UserSubscribe request body.
 */
export function createSubscribeBody(options?: {
  endpointArn?: string
  topicArn?: string
}): string {
  return JSON.stringify({
    endpointArn: options?.endpointArn ?? `arn:aws:sns:${DEFAULT_REGION}:${DEFAULT_ACCOUNT_ID}:endpoint/APNS/app/device-uuid`,
    topicArn: options?.topicArn ?? `arn:aws:sns:${DEFAULT_REGION}:${DEFAULT_ACCOUNT_ID}:PushNotifications`
  })
}

/**
 * Creates a WebhookFeedly request body.
 */
export function createFeedlyWebhookBody(options?: {
  articleURL?: string
}): string {
  return JSON.stringify({
    articleURL: options?.articleURL ?? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  })
}
