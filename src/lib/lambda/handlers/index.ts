/**
 * Lambda Handler Base Classes
 *
 * Provides abstract base classes for all Lambda handler types with built-in observability.
 * Uses TypeScript decorators for declarative metrics, logging, and tracing.
 *
 * @example See any Lambda in src/lambdas/ for implementation examples
 */

// Base handler with core decorators
export { BaseHandler, InjectContext, logger, LogMetrics, metrics, MetricUnit, Traced } from './BaseHandler'

// API Gateway handlers
export { ApiHandler } from './ApiHandler'
export { AuthenticatedHandler } from './AuthenticatedHandler'
export { OptionalAuthHandler } from './OptionalAuthHandler'

// SQS handlers
export { SqsHandler } from './SqsHandler'

// S3 event handlers
export { S3EventHandler } from './S3EventHandler'

// Scheduled handlers
export { ScheduledHandler } from './ScheduledHandler'

// Invoke handlers (manual/Lambda-to-Lambda)
export { InvokeHandler } from './InvokeHandler'

// Custom authorizer handlers
export { AuthorizerHandler } from './AuthorizerHandler'

// Database permissions decorator
export { computeAccessLevel, getDatabasePermissions, RequiresDatabase } from './RequiresDatabase'

// Secret permissions decorator
export { getSecretPermissions, RequiresSecrets } from './RequiresSecrets'

// AWS service permissions decorator
export { getServicePermissions, RequiresServices } from './RequiresServices'

// EventBridge permissions decorator
export { getEventBridgePermissions, RequiresEventBridge } from './RequiresEventBridge'

// DynamoDB permissions decorator
export { getDynamoDBPermissions, RequiresDynamoDB, RequiresIdempotency } from './RequiresDynamoDB'

// Re-export types from centralized types module
export type { S3RecordContext, ScheduledResult, SqsBatchOptions, SqsRecordContext } from '#types/lambda'
