/**
 * Lambda Handler Wrapper Types
 *
 * Type definitions for the Lambda handler wrapper functions in lambda-helpers.ts.
 * These types enable object destructuring in handler signatures, eliminating
 * the need for underscore-prefixed unused parameters.
 *
 * @see src/util/lambda-helpers.ts - Implementation of wrapper functions
 * @see docs/wiki/TypeScript/Lambda-Function-Patterns.md - Usage patterns
 */

import type {APIGatewayRequestAuthorizerEvent, Context, ScheduledEvent} from 'aws-lambda'
import type {CustomAPIGatewayRequestAuthorizerEvent} from './infrastructure-types'
import type {UserStatus} from './enums'

/** Metadata passed to all wrapped handlers */
export type WrapperMetadata = {traceId: string}

/** Parameters passed to wrapped API Gateway handlers */
export type ApiHandlerParams<TEvent = CustomAPIGatewayRequestAuthorizerEvent> = {event: TEvent; context: Context; metadata: WrapperMetadata}

/** Parameters passed to wrapped authorizer handlers */
export type AuthorizerParams = {event: APIGatewayRequestAuthorizerEvent; context: Context; metadata: WrapperMetadata}

/** Parameters passed to wrapped event handlers (S3, SQS) */
export type EventHandlerParams<TRecord> = {record: TRecord; context: Context; metadata: WrapperMetadata}

/** Parameters passed to wrapped scheduled handlers */
export type ScheduledHandlerParams = {event: ScheduledEvent; context: Context; metadata: WrapperMetadata}

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
