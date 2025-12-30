/**
 * Lambda Handler Types
 *
 * Type definitions for Lambda handler wrappers and their parameters.
 * These types enable type-safe middleware composition.
 *
 * Handler Flow:
 * 1. External event (API Gateway, S3, CloudWatch) triggers Lambda
 * 2. Wrapper extracts event, context, and creates metadata
 * 3. Handler receives typed params with guaranteed fields
 *
 * @see src/lib/lambda/middleware/ for wrapper implementations
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/TypeScript/Lambda-Middleware-Patterns | Middleware Guide}
 */

import type {APIGatewayRequestAuthorizerEvent, CloudFrontResponse, CloudFrontResultResponse, Context, ScheduledEvent} from 'aws-lambda'
import type {CloudFrontCustomOrigin, CloudFrontRequest} from 'aws-lambda/common/cloudfront'
import type {CustomAPIGatewayRequestAuthorizerEvent} from './infrastructure-types'
import type {UserStatus} from './enums'

// ============================================================================
// Wrapper Parameter Types
// ============================================================================

/**
 * Metadata passed to all wrapped handlers.
 * Used for distributed tracing and request correlation.
 */
export type WrapperMetadata = {
  /** AWS request ID for this Lambda invocation */
  traceId: string
  /** Correlation ID for end-to-end request tracing across services */
  correlationId: string
}

/**
 * Options for withPowertools middleware.
 * Controls which Powertools features are enabled for a Lambda handler.
 */
export interface PowertoolsOptions {
  /**
   * Enable full metrics middleware for lambdas that publish custom metrics.
   * When true, enables the Powertools logMetrics middleware which flushes all
   * stored metrics at request end.
   *
   * Cold start metrics are tracked automatically for ALL lambdas regardless
   * of this setting - this option only controls custom metrics publishing.
   *
   * Defaults to false. Only set to true for lambdas that call metrics.addMetric().
   * Currently: FileCoordinator and StartFileUpload publish custom metrics.
   */
  enableCustomMetrics?: boolean
}

/**
 * Parameters passed to wrapped API Gateway handlers.
 * Used with wrapApiHandler for unauthenticated or custom auth handlers.
 *
 * @see wrapApiHandler for implementation
 */
export type ApiHandlerParams<TEvent = CustomAPIGatewayRequestAuthorizerEvent> = {
  /** Original API Gateway event with request data */
  event: TEvent
  /** AWS Lambda execution context */
  context: Context
  /** Tracing metadata */
  metadata: WrapperMetadata
}

/**
 * Parameters passed to wrapped authorizer handlers.
 * Used for API Gateway custom authorizers.
 *
 * @see ApiGatewayAuthorizer Lambda for implementation
 */
export type AuthorizerParams = {
  /** API Gateway authorizer event with token/identity */
  event: APIGatewayRequestAuthorizerEvent
  /** AWS Lambda execution context */
  context: Context
  /** Tracing metadata */
  metadata: WrapperMetadata
}

/**
 * Parameters passed to wrapped event handlers (S3, SQS).
 * Processes one record at a time from a batch.
 *
 * @see wrapS3EventHandler for S3 events
 * @see wrapSQSHandler for SQS messages
 */
export type EventHandlerParams<TRecord> = {
  /** Single record from the event batch */
  record: TRecord
  /** AWS Lambda execution context */
  context: Context
  /** Tracing metadata */
  metadata: WrapperMetadata
}

/**
 * Parameters passed to wrapped scheduled handlers.
 * Used for CloudWatch Events/EventBridge scheduled invocations.
 *
 * @see wrapScheduledHandler for implementation
 * @see FileCoordinator, PruneDevices for examples
 */
export type ScheduledHandlerParams = {
  /** CloudWatch scheduled event with time and resources */
  event: ScheduledEvent
  /** AWS Lambda execution context */
  context: Context
  /** Tracing metadata */
  metadata: WrapperMetadata
}

/**
 * Parameters passed to Lambda-to-Lambda invoke handlers.
 * Used for async invocations between Lambdas.
 *
 * @see wrapLambdaInvokeHandler for implementation
 * @see StartFileUpload for example (invoked by FileCoordinator)
 */
export type LambdaInvokeHandlerParams<TEvent> = {
  /** Custom event payload from invoking Lambda */
  event: TEvent
  /** AWS Lambda execution context */
  context: Context
  /** Tracing metadata */
  metadata: WrapperMetadata
}

/**
 * Parameters passed to authenticated API handlers.
 *
 * userId is guaranteed to be a string (not optional) - the wrapper enforces this
 * by rejecting Unauthenticated and Anonymous users before the handler runs.
 *
 * @see wrapAuthenticatedHandler for implementation
 */
export type AuthenticatedApiParams<TEvent = CustomAPIGatewayRequestAuthorizerEvent> = {
  /** Original API Gateway event */
  event: TEvent
  /** AWS Lambda execution context */
  context: Context
  /** Tracing metadata */
  metadata: WrapperMetadata
  /** Authenticated user ID (guaranteed non-null) */
  userId: string
}

/**
 * Parameters passed to optional-auth API handlers.
 *
 * Allows both Anonymous and Authenticated users (rejects only Unauthenticated).
 * Handler receives userStatus to differentiate behavior.
 *
 * @see wrapOptionalAuthHandler for implementation
 * @see ListFiles for example (returns demo file for anonymous users)
 */
export type OptionalAuthApiParams<TEvent = CustomAPIGatewayRequestAuthorizerEvent> = {
  /** Original API Gateway event */
  event: TEvent
  /** AWS Lambda execution context */
  context: Context
  /** Tracing metadata */
  metadata: WrapperMetadata
  /** User ID (undefined for anonymous users) */
  userId: string | undefined
  /** Authentication status for conditional logic */
  userStatus: UserStatus
}

/**
 * Parameters passed to validated API handlers.
 * Used with wrapValidatedHandler for automatic request body validation.
 *
 * @see wrapValidatedHandler for implementation
 */
export type ValidatedApiParams<TBody, TEvent = CustomAPIGatewayRequestAuthorizerEvent> = {
  /** Original API Gateway event */
  event: TEvent
  /** AWS Lambda execution context */
  context: Context
  /** Tracing metadata */
  metadata: WrapperMetadata
  /** Validated and typed request body */
  body: TBody
}

/**
 * Parameters passed to authenticated + validated API handlers.
 * Combines authentication enforcement with request body validation.
 *
 * @see wrapAuthenticatedValidatedHandler for implementation
 */
export type AuthenticatedValidatedParams<TBody, TEvent = CustomAPIGatewayRequestAuthorizerEvent> = {
  /** Original API Gateway event */
  event: TEvent
  /** AWS Lambda execution context */
  context: Context
  /** Tracing metadata */
  metadata: WrapperMetadata
  /** Authenticated user ID (guaranteed non-null) */
  userId: string
  /** Validated and typed request body */
  body: TBody
}

// ============================================================================
// SQS Batch Processing Types
// ============================================================================

/**
 * Parameters passed to SQS batch handlers for each record.
 * Used with wrapSqsBatchHandler for standardized batch processing.
 *
 * @see wrapSqsBatchHandler for implementation
 */
export type SqsRecordParams<TBody = unknown> = {
  /** Original SQS record */
  record: import('aws-lambda').SQSRecord
  /** Parsed and typed message body */
  body: TBody
  /** AWS Lambda execution context */
  context: Context
  /** Tracing metadata */
  metadata: WrapperMetadata
  /** SQS message attributes */
  messageAttributes: import('aws-lambda').SQSRecord['messageAttributes']
}

/**
 * Options for SQS batch handler wrapper.
 */
export interface SqsBatchOptions {
  /** Parse body as JSON (default: true) */
  parseBody?: boolean
  /** Stop on first error instead of continuing (default: false) */
  stopOnError?: boolean
}

// ============================================================================
// Sanitization Types
// ============================================================================

/**
 * Options for input sanitization middleware.
 * Controls which sanitization rules are applied to request bodies.
 */
export interface SanitizationOptions {
  /** Fields to skip sanitization (e.g., password, token) */
  skipFields?: string[]
  /** Maximum string length (truncate longer) */
  maxLength?: number
  /** Remove HTML tags completely (default: true) */
  stripHtml?: boolean
  /** Remove control characters (default: true) */
  stripControlChars?: boolean
}

// ============================================================================
// Security Headers Types
// ============================================================================

/**
 * Options for security headers middleware.
 * Configures CORS and other security headers.
 */
export interface SecurityHeadersOptions {
  /** CORS allowed origins (default: '*') */
  corsOrigins?: string | string[]
  /** CORS allowed methods (default: 'GET,POST,PUT,DELETE,OPTIONS') */
  corsMethods?: string
  /** CORS allowed headers */
  corsHeaders?: string
  /** Content-Security-Policy value */
  csp?: string
  /** X-Frame-Options value (default: 'DENY') */
  frameOptions?: 'DENY' | 'SAMEORIGIN'
  /** Custom headers to add */
  customHeaders?: Record<string, string>
}

// ============================================================================
// Operation Result Types
// ============================================================================

/**
 * Result of the PruneDevices scheduled operation.
 * Returned to indicate cleanup statistics.
 *
 * @see PruneDevices Lambda for implementation
 */
export interface PruneDevicesResult {
  /** Total devices checked for staleness */
  devicesChecked: number
  /** Number of stale devices removed */
  devicesPruned: number
  /** Error messages for any failed operations */
  errors: string[]
}

/**
 * Result of the CleanupExpiredRecords scheduled operation.
 * Returned to indicate cleanup statistics for expired records.
 *
 * @see CleanupExpiredRecords Lambda for implementation
 */
export interface CleanupResult {
  /** Number of file downloads deleted */
  fileDownloadsDeleted: number
  /** Number of sessions deleted */
  sessionsDeleted: number
  /** Number of verification tokens deleted */
  verificationTokensDeleted: number
  /** Error messages for any failed operations */
  errors: string[]
}

/**
 * Response from Apple Push Notification Service.
 * Used to track delivery success/failure.
 *
 * @see SendPushNotification Lambda for usage
 */
export interface ApplePushNotificationResponse {
  /** HTTP status code from APNS (200 = success) */
  statusCode: number
  /** Error reason if status is not 200 */
  reason?: string
}

// ============================================================================
// CloudFront Types
// ============================================================================

/**
 * Union type for CloudFront Lambda\@Edge handler results.
 * Allows returning modified request, generated response, or pass-through.
 */
export type CloudFrontHandlerResult = CloudFrontRequest | CloudFrontResultResponse | CloudFrontResponse

/**
 * CloudFront origin configuration for custom origins.
 * Used when forwarding to API Gateway or S3.
 */
export type CustomCloudFrontOrigin = {custom: CloudFrontCustomOrigin}

/**
 * Extended CloudFront request with guaranteed clientIp and origin.
 * Used for edge processing and request routing.
 *
 * @see CloudfrontMiddleware Lambda for implementation
 */
export interface CustomCloudFrontRequest extends CloudFrontRequest {
  /** Client IP address from CloudFront headers */
  clientIp: string
  /** Custom origin configuration for routing */
  origin: CustomCloudFrontOrigin
}

// ============================================================================
// Migration Types
// ============================================================================

/**
 * Result of running database migrations.
 * Returned by MigrateDSQL Lambda to indicate migration status.
 */
export interface MigrationResult {
  /** Migration versions that were applied in this run */
  applied: string[]
  /** Migration versions that were skipped (already applied) */
  skipped: string[]
  /** Error messages for failed migrations */
  errors: string[]
}
