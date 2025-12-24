import type {APIGatewayRequestAuthorizerEvent, CloudFrontResponse, CloudFrontResultResponse, Context, ScheduledEvent} from 'aws-lambda'
import type {CloudFrontCustomOrigin, CloudFrontRequest} from 'aws-lambda/common/cloudfront'
import type {CustomAPIGatewayRequestAuthorizerEvent} from './infrastructure-types'
import type {UserStatus} from './enums'

// --- Wrappers ---

/** Metadata passed to all wrapped handlers */
export type WrapperMetadata = {traceId: string}

/**
 * Options for withPowertools middleware
 */
export interface PowertoolsOptions {
  /**
   * Enable metrics middleware. Set to true for lambdas that publish custom metrics.
   * Defaults to false (metrics disabled) to avoid "No application metrics to publish" warnings.
   * Only FileCoordinator and StartFileUpload currently publish custom metrics.
   */
  enableMetrics?: boolean
}

/** Parameters passed to wrapped API Gateway handlers */
export type ApiHandlerParams<TEvent = CustomAPIGatewayRequestAuthorizerEvent> = {event: TEvent; context: Context; metadata: WrapperMetadata}

/** Parameters passed to wrapped authorizer handlers */
export type AuthorizerParams = {event: APIGatewayRequestAuthorizerEvent; context: Context; metadata: WrapperMetadata}

/** Parameters passed to wrapped event handlers (S3, SQS) */
export type EventHandlerParams<TRecord> = {record: TRecord; context: Context; metadata: WrapperMetadata}

/** Parameters passed to wrapped scheduled handlers */
export type ScheduledHandlerParams = {event: ScheduledEvent; context: Context; metadata: WrapperMetadata}

/** Parameters passed to Lambda-to-Lambda invoke handlers */
export type LambdaInvokeHandlerParams<TEvent> = {event: TEvent; context: Context; metadata: WrapperMetadata}

/**
 * Parameters passed to authenticated API handlers.
 * userId is guaranteed to be a string (not optional) - the wrapper enforces this
 * by rejecting Unauthenticated and Anonymous users before the handler runs.
 */
export type AuthenticatedApiParams<TEvent = CustomAPIGatewayRequestAuthorizerEvent> = {
  event: TEvent
  context: Context
  metadata: WrapperMetadata
  userId: string
}

/**
 * Parameters passed to optional-auth API handlers.
 * Allows both Anonymous and Authenticated users (rejects only Unauthenticated).
 * Handler receives userStatus to differentiate behavior.
 */
export type OptionalAuthApiParams<TEvent = CustomAPIGatewayRequestAuthorizerEvent> = {
  event: TEvent
  context: Context
  metadata: WrapperMetadata
  userId: string | undefined
  userStatus: UserStatus
}

// --- Payloads ---

/**
 * Result of the PruneDevices operation
 */
export interface PruneDevicesResult {
  devicesChecked: number
  devicesPruned: number
  errors: string[]
}

export interface ApplePushNotificationResponse {
  statusCode: number
  reason?: string
}

export type CloudFrontHandlerResult = CloudFrontRequest | CloudFrontResultResponse | CloudFrontResponse

export type CustomCloudFrontOrigin = {custom: CloudFrontCustomOrigin}

export interface CustomCloudFrontRequest extends CloudFrontRequest {
  clientIp: string
  origin: CustomCloudFrontOrigin
}
