/**
 * OpenTelemetry Tracing API
 *
 * Provides a simplified API for distributed tracing that sends data to AWS X-Ray
 * via the ADOT (AWS Distro for OpenTelemetry) collector.
 *
 * This module replaces the legacy aws-xray-sdk-core with native OpenTelemetry,
 * enabling full ESM support without the need for CJS compatibility shims.
 *
 * @see https://docs.aws.amazon.com/xray/latest/devguide/migrate-xray-to-opentelemetry-nodejs.html
 */
import {trace, SpanKind, SpanStatusCode} from '@opentelemetry/api'
import type {Span, Tracer} from '@opentelemetry/api'
import type {Context} from 'aws-lambda'

/**
 * Check if tracing is enabled
 * Tracing is disabled for LocalStack (unsupported) and when ENABLE_XRAY=false
 * @returns true if tracing should be enabled
 */
function isTracingEnabled(): boolean {
  return process.env.ENABLE_XRAY !== 'false' && process.env.USE_LOCALSTACK !== 'true'
}

/**
 * Get a tracer instance for creating spans
 * @param name - Optional tracer name, defaults to Lambda function name
 * @returns OpenTelemetry Tracer instance
 */
export function getTracer(name?: string): Tracer {
  return trace.getTracer(name || process.env.AWS_LAMBDA_FUNCTION_NAME || 'MediaDownloader')
}

/**
 * Get the currently active span
 * Returns undefined if tracing is disabled or no span is active
 *
 * @returns The active span or undefined
 */
export function getCurrentSpan(): Span | undefined {
  if (!isTracingEnabled()) return undefined
  return trace.getActiveSpan()
}

/**
 * Start a new span (equivalent to X-Ray subsegment)
 * Returns null if tracing is disabled
 *
 * @param name - Name of the span/subsegment
 * @param kind - SpanKind (default: INTERNAL)
 * @returns New span or null if tracing disabled
 *
 * @example
 * ```typescript
 * const span = startSpan('database-query')
 * try {
 *   const result = await query()
 *   endSpan(span)
 *   return result
 * } catch (error) {
 *   endSpan(span, error as Error)
 *   throw error
 * }
 * ```
 */
export function startSpan(name: string, kind: SpanKind = SpanKind.INTERNAL): Span | null {
  if (!isTracingEnabled()) return null
  return getTracer().startSpan(name, {kind})
}

/**
 * Add an annotation to a span
 * Annotations are indexed and searchable in X-Ray
 *
 * @param span - The span to annotate (null-safe)
 * @param key - Annotation key
 * @param value - Annotation value (string)
 */
export function addAnnotation(span: Span | null, key: string, value: string): void {
  if (!span) return
  span.setAttribute(key, value)
  // Mark as X-Ray annotation by adding to the annotations list
  const existingAnnotations = (span as unknown as {attributes?: Record<string, unknown>}).attributes?.['aws.xray.annotations']
  const annotations = Array.isArray(existingAnnotations) ? [...existingAnnotations, key] : [key]
  span.setAttribute('aws.xray.annotations', annotations)
}

/**
 * Add metadata to a span
 * Metadata is stored but not indexed (for detailed debugging info)
 *
 * @param span - The span to add metadata to (null-safe)
 * @param key - Metadata key
 * @param value - Metadata value (any serializable type)
 */
export function addMetadata(span: Span | null, key: string, value: unknown): void {
  if (!span) return
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    span.setAttribute(key, value)
  } else {
    span.setAttribute(key, JSON.stringify(value))
  }
}

/**
 * End a span, optionally recording an error
 *
 * @param span - The span to end (null-safe)
 * @param error - Optional error to record
 */
export function endSpan(span: Span | null, error?: Error): void {
  if (!span) return
  if (error) {
    span.setStatus({code: SpanStatusCode.ERROR, message: error.message})
    span.recordException(error)
  }
  span.end()
}

/**
 * Higher-order function that wraps Lambda handlers with trace context
 * Extracts trace ID from active span or falls back to AWS request ID
 *
 * @param handler - Lambda handler function that receives event, context, and metadata
 * @returns Wrapped handler compatible with AWS Lambda runtime
 *
 * @example
 * ```typescript
 * export const handler = withTracing(async (event, context, metadata) => {
 *   console.log('Trace ID:', metadata?.traceId)
 *   // ... handler logic
 * })
 * ```
 */
export function withTracing<TEvent = unknown, TResult = unknown>(
  handler: (event: TEvent, context: Context, metadata?: {traceId: string}) => Promise<TResult>
) {
  return async (event: TEvent, ctx: Context): Promise<TResult> => {
    let traceId = ctx.awsRequestId

    if (isTracingEnabled()) {
      const activeSpan = trace.getActiveSpan()
      if (activeSpan) {
        traceId = activeSpan.spanContext().traceId
      }
    }

    return handler(event, ctx, {traceId})
  }
}

// Re-export SpanKind for consumers who need to specify span types
export {SpanKind}
