/**
 * Test Data Helpers
 *
 * Reusable factory functions for creating mock test data across integration tests.
 * Reduces inline JSON and provides consistent test data patterns.
 */

import type {APIGatewayProxyEvent, APIGatewayRequestAuthorizerEvent, S3Event, ScheduledEvent, SQSEvent} from 'aws-lambda'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import {UserStatus} from '#types/enums'
import {FileStatus} from '#types/enums'
import type {Device, File, User} from '#types/domain-models'

/**
 * Creates a mock file object with sensible defaults
 * Provides ALL required ElectroDB fields for database operations
 * @param id - File ID (e.g., 'video-123')
 * @param status - File status from FileStatus enum
 * @param partial - Partial file data to override defaults
 */
export function createMockFile(id: string, status: FileStatus, partial?: Partial<File>): Partial<File> {
  const base: Partial<File> = {
    fileId: id,
    status,
    title: `Test Video ${id}`,
    authorName: 'Test Channel',
    authorUser: 'testchannel',
    publishDate: new Date().toISOString(),
    description: `Test description for ${id}`,
    contentType: 'video/mp4',
    size: 0,
    key: `${id}.mp4`
  }

  // Add Downloaded-specific fields (downloaded files)
  if (status === FileStatus.Downloaded) {
    base.size = 5242880
    base.url = `https://example.com/${id}.mp4`
  }

  return {...base, ...partial}
}

/**
 * Creates an array of mock files for batch testing
 * @param count - Number of files to create
 * @param status - Status for all files
 * @param idPrefix - Prefix for file IDs (default: 'video')
 */
export function createMockFiles(count: number, status: FileStatus, idPrefix = 'video'): Partial<File>[] {
  return Array.from({length: count}, (_, i) => createMockFile(`${idPrefix}-${i}`, status))
}

/**
 * Creates a mock UserFile record (user-file association)
 * @param userId - User UUID
 * @param fileId - File ID
 */
export function createMockUserFile(userId: string, fileId: string) {
  return {userId, fileId}
}

/**
 * Creates a mock UserDevice record (user-device association)
 * @param userId - User UUID
 * @param deviceId - Device UUID
 */
export function createMockUserDevice(userId: string, deviceId: string) {
  return {userId, deviceId}
}

/**
 * Creates a mock Device record with endpoint ARN.
 * @param partial - Partial device fields to override defaults
 */
export function createMockDevice(partial?: Partial<Device>): Partial<Device> {
  const deviceId = partial?.deviceId || `device-${Math.random().toString(36).substring(7)}`
  return {
    deviceId,
    name: partial?.name || 'Test iPhone',
    token: partial?.token || `token-${deviceId}`,
    systemVersion: partial?.systemVersion || '17.0',
    systemName: partial?.systemName || 'iOS',
    endpointArn: partial?.endpointArn || `arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/${deviceId}`,
    ...partial
  }
}

/**
 * Creates a mock User record with sensible defaults
 * @param partial - Partial user data to override defaults
 */
export function createMockUser(partial?: Partial<User> & {appleDeviceId?: string; userId?: string}): Partial<User> & {appleDeviceId?: string} {
  // Support both 'id' (domain type) and 'userId' (legacy tests) for backwards compatibility
  const id = partial?.id || partial?.userId || `user-${Math.random().toString(36).substring(7)}`
  return {
    id,
    email: partial?.email || `${id}@example.com`,
    emailVerified: partial?.emailVerified ?? true,
    firstName: partial?.firstName || 'Test',
    lastName: partial?.lastName || 'User',
    appleDeviceId: partial?.appleDeviceId,
    ...partial
  }
}

/**
 * Creates an SQS FileNotification event
 * @param userId - User ID to send notification to
 * @param fileId - File ID for the notification
 * @param partial - Partial file data to override defaults in message attributes
 * @param notificationType - Notification type (default: 'DownloadReadyNotification')
 */
export function createMockSQSFileNotificationEvent(
  userId: string,
  fileId: string,
  partial?: {title?: string; size?: number; url?: string},
  notificationType = 'DownloadReadyNotification'
): SQSEvent {
  const file = createMockFile(fileId, FileStatus.Downloaded, partial)

  // Body must be JSON matching what createDownloadReadyNotification produces
  // SendPushNotification parses this with JSON.parse in transformToAPNSNotification
  const messageBody = JSON.stringify({
    file: {fileId, key: file.key || `${fileId}.mp4`, size: file.size || 5242880, url: file.url || `https://example.com/${fileId}.mp4`},
    notificationType
  })

  return {
    Records: [{
      messageId: `test-message-${fileId}`,
      receiptHandle: `test-receipt-${fileId}`,
      body: messageBody,
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: String(Date.now()),
        SenderId: 'test-sender',
        ApproximateFirstReceiveTimestamp: String(Date.now())
      },
      messageAttributes: {
        notificationType: {stringValue: notificationType, dataType: 'String'},
        userId: {stringValue: userId, dataType: 'String'},
        fileId: {stringValue: fileId, dataType: 'String'},
        key: {stringValue: file.key || `${fileId}.mp4`, dataType: 'String'},
        publishDate: {stringValue: file.publishDate || new Date().toISOString(), dataType: 'String'},
        size: {stringValue: String(file.size || 5242880), dataType: 'String'},
        url: {stringValue: file.url || `https://example.com/${fileId}.mp4`, dataType: 'String'},
        title: {stringValue: file.title || 'Test Video', dataType: 'String'}
      },
      md5OfBody: 'test-md5',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:test-queue',
      awsRegion: 'us-west-2'
    }]
  }
}

/**
 * Creates an SQS event for the DownloadQueue (StartFileUpload consumer)
 * @param fileId - Video file ID
 * @param options - Optional overrides for message fields
 */
export function createMockDownloadQueueEvent(
  fileId: string,
  options?: {messageId?: string; sourceUrl?: string; correlationId?: string; userId?: string; attempt?: number}
): SQSEvent {
  const messageId = options?.messageId ?? `msg-${fileId}`
  const sourceUrl = options?.sourceUrl ?? `https://www.youtube.com/watch?v=${fileId}`
  const correlationId = options?.correlationId ?? `corr-${fileId}`
  const userId = options?.userId ?? 'test-user'
  const attempt = options?.attempt ?? 1

  return {
    Records: [{
      messageId,
      receiptHandle: `receipt-${messageId}`,
      body: JSON.stringify({fileId, sourceUrl, correlationId, userId, attempt}),
      attributes: {
        ApproximateReceiveCount: String(attempt),
        SentTimestamp: String(Date.now()),
        SenderId: 'AIDAIT2UOQQY3AUEKVGXU',
        ApproximateFirstReceiveTimestamp: String(Date.now())
      },
      messageAttributes: {},
      md5OfBody: 'test-md5',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:DownloadQueue',
      awsRegion: 'us-west-2'
    }]
  }
}

/**
 * Creates a CloudWatch Events / EventBridge scheduled event
 * @param eventId - Unique event ID
 * @param ruleName - Name of the EventBridge rule (default: 'ScheduledEvent')
 */
export function createMockScheduledEvent(eventId: string, ruleName = 'ScheduledEvent'): ScheduledEvent {
  return {
    id: eventId,
    version: '0',
    account: '123456789012',
    'detail-type': 'Scheduled Event',
    source: 'aws.events',
    time: new Date().toISOString(),
    region: 'us-west-2',
    resources: [`arn:aws:events:us-west-2:123456789012:rule/${ruleName}`],
    detail: {}
  }
}

/**
 * Creates an S3 object creation event for testing S3ObjectCreated Lambda
 * @param key - S3 object key (file path in bucket)
 * @param options - Optional overrides for event fields
 */
export function createMockS3Event(key: string, options?: {bucket?: string; size?: number; eventName?: string; correlationId?: string}): S3Event {
  const bucket = options?.bucket ?? 'test-media-bucket'
  const size = options?.size ?? 5242880
  const eventName = options?.eventName ?? 'ObjectCreated:Put'
  const eventTime = new Date().toISOString()

  // S3 keys are URL-encoded in events
  const encodedKey = encodeURIComponent(key).replace(/%20/g, '+')

  // Build user metadata with optional correlation ID
  const userMetadata: Record<string, string> = {}
  if (options?.correlationId) {
    userMetadata['x-amz-meta-correlation-id'] = options.correlationId
  }

  return {
    Records: [{
      eventVersion: '2.1',
      eventSource: 'aws:s3',
      awsRegion: 'us-west-2',
      eventTime,
      eventName,
      userIdentity: {principalId: 'EXAMPLE'},
      requestParameters: {sourceIPAddress: '127.0.0.1'},
      responseElements: {'x-amz-request-id': 'EXAMPLE123456789', 'x-amz-id-2': 'EXAMPLE123/5678abcdefghijklambdaisawesome/mnopqrstuvwxyzABCDEFGH'},
      s3: {
        s3SchemaVersion: '1.0',
        configurationId: 'testConfigRule',
        bucket: {name: bucket, ownerIdentity: {principalId: 'EXAMPLE'}, arn: `arn:aws:s3:::${bucket}`},
        object: {key: encodedKey, size, eTag: '0123456789abcdef0123456789abcdef', sequencer: '0A1B2C3D4E5F678901', ...userMetadata}
      }
    }]
  }
}

/**
 * Creates an S3 event with multiple records for batch testing
 * @param keys - Array of S3 object keys
 * @param bucket - S3 bucket name (default: 'test-media-bucket')
 */
export function createMockS3BatchEvent(keys: string[], bucket = 'test-media-bucket'): S3Event {
  const baseEvent = createMockS3Event(keys[0], {bucket})
  const additionalRecords = keys.slice(1).map((key) => createMockS3Event(key, {bucket}).Records[0])

  return {Records: [...baseEvent.Records, ...additionalRecords]}
}

/**
 * Creates a basic API Gateway proxy event for Lambda handler testing
 * @param options - Event configuration options
 */
export function createMockAPIGatewayEvent(
  options: {
    httpMethod: string
    path: string
    body?: string | null
    headers?: Record<string, string>
    pathParameters?: Record<string, string> | null
    queryStringParameters?: Record<string, string> | null
    principalId?: string
  }
): APIGatewayProxyEvent {
  return {
    httpMethod: options.httpMethod,
    path: options.path,
    headers: options.headers ?? {'Content-Type': 'application/json'},
    body: options.body ?? null,
    isBase64Encoded: false,
    pathParameters: options.pathParameters ?? null,
    queryStringParameters: options.queryStringParameters ?? null,
    multiValueQueryStringParameters: null,
    multiValueHeaders: {},
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: options.principalId ? {principalId: options.principalId} : {},
      httpMethod: options.httpMethod,
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null
      },
      path: options.path,
      protocol: 'HTTP/1.1',
      requestId: `test-request-${Date.now()}`,
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: options.path,
      stage: 'test'
    },
    resource: options.path
  }
}

/**
 * Creates an API Gateway authorizer request event
 * @param overrides - Partial event overrides
 */
export function createMockAuthorizerEvent(overrides: Partial<APIGatewayRequestAuthorizerEvent> = {}): APIGatewayRequestAuthorizerEvent {
  return {
    type: 'REQUEST',
    methodArn: 'arn:aws:execute-api:us-west-2:123456789012:api-id/stage/GET/resource',
    resource: '/resource',
    path: '/resource',
    httpMethod: 'GET',
    headers: {Authorization: 'Bearer valid-session-token', 'User-Agent': 'iOS/17.0 TestApp/1.0'},
    multiValueHeaders: {},
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: undefined,
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      path: '/resource',
      stage: 'test',
      requestId: `test-${Date.now()}`,
      requestTime: '01/Jan/2024:00:00:00 +0000',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/resource',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'iOS/17.0 TestApp/1.0',
        userArn: null
      }
    },
    ...overrides
  }
}

/**
 * Creates a custom API Gateway event with authorizer context (for authenticated routes)
 * @param options - Event configuration options
 */
export function createMockAuthenticatedEvent(options: {
  httpMethod: string
  path: string
  userId: string
  userStatus?: UserStatus
  body?: string | null
  headers?: Record<string, string>
}): CustomAPIGatewayRequestAuthorizerEvent {
  return {
    body: options.body ?? null,
    headers: options.headers ?? {Authorization: `Bearer test-token-${options.userId}`, 'Content-Type': 'application/json'},
    multiValueHeaders: {},
    httpMethod: options.httpMethod,
    isBase64Encoded: false,
    path: options.path,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      protocol: 'HTTP/1.1',
      httpMethod: options.httpMethod,
      path: options.path,
      stage: 'test',
      requestId: `test-request-${Date.now()}`,
      requestTime: '01/Jan/2024:00:00:00 +0000',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: options.path,
      authorizer: {principalId: options.userId, userId: options.userId, userStatus: options.userStatus ?? UserStatus.Authenticated, integrationLatency: 100},
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null
      }
    },
    resource: options.path
  } as CustomAPIGatewayRequestAuthorizerEvent
}
