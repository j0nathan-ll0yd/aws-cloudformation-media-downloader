/**
 * Context attached to errors for debugging and observability.
 * Captured by middleware and attached to CustomLambdaError instances.
 */
export interface ErrorContext {
  /** Correlation ID for end-to-end request tracing */
  correlationId?: string
  /** AWS request ID for this Lambda invocation */
  traceId?: string
  /** Authenticated user ID (if available) */
  userId?: string
  /** Lambda function name */
  lambdaName?: string
  /** ISO timestamp when error occurred */
  timestamp: string
  /** HTTP method (for API Gateway events) */
  httpMethod?: string
  /** Request path (for API Gateway events) */
  path?: string
}

/**
 * Request information used for error context enrichment.
 * Extracted from API Gateway events to provide debugging context.
 */
export interface RequestInfo {
  /** Authenticated user ID (if available) */
  userId?: string
  /** Request path (e.g., /api/users/123) */
  path?: string
  /** HTTP method (GET, POST, etc.) */
  httpMethod?: string
}
