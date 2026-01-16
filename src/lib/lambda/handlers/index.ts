/**
 * Lambda Handler Base Classes
 *
 * Provides abstract base classes for all Lambda handler types with built-in observability.
 * Uses TypeScript decorators for declarative metrics, logging, and tracing.
 *
 * @example
 * ```typescript
 * import {AuthenticatedHandler, logger, metrics, MetricUnit} from '#lib/lambda/handlers'
 *
 * class MyHandler extends AuthenticatedHandler {
 *   readonly operationName = 'MyOperation'
 *
 *   protected async handleAuthenticated(event, context) {
 *     // Business logic here
 *     // this.userId is guaranteed to be a valid string
 *   }
 * }
 *
 * const handlerInstance = new MyHandler()
 * export const handler = handlerInstance.handler.bind(handlerInstance)
 * ```
 */

// Base handler with core decorators
export { BaseHandler, InjectContext, logger, LogMetrics, metrics, MetricUnit, Traced } from './BaseHandler'

// API Gateway handlers
export { ApiHandler } from './ApiHandler'
export { AuthenticatedHandler } from './AuthenticatedHandler'
export { OptionalAuthHandler } from './OptionalAuthHandler'

// SQS handlers
export { SqsHandler } from './SqsHandler'
export type { SqsBatchOptions, SqsRecordContext } from './SqsHandler'

// S3 event handlers
export { S3EventHandler } from './S3EventHandler'
export type { S3RecordContext } from './S3EventHandler'

// Scheduled handlers
export { ScheduledHandler } from './ScheduledHandler'
export type { ScheduledResult } from './ScheduledHandler'

// Invoke handlers (manual/Lambda-to-Lambda)
export { InvokeHandler } from './InvokeHandler'

// Custom authorizer handlers
export { AuthorizerHandler } from './AuthorizerHandler'
