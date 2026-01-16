/**
 * Base Handler Classes for AWS Lambda
 *
 * Provides abstract base classes with built-in observability via decorators.
 * Uses AWS Lambda Powertools for logging/metrics and OpenTelemetry for tracing.
 *
 * Class hierarchy:
 * - BaseHandler: Core handler with decorators for all event types
 * - AuthenticatedHandler: API Gateway handlers requiring authentication
 * - OptionalAuthHandler: API Gateway handlers with optional authentication
 * - SqsHandler: SQS batch processing with partial failure support
 * - ScheduledHandler: CloudWatch scheduled event handlers
 */
import type {Context} from 'aws-lambda'
import {logger, metrics, MetricUnit} from '#lib/vendor/Powertools'
import {addAnnotation, addMetadata, endSpan, startSpan} from '#lib/vendor/OpenTelemetry'
import type {Span} from '@opentelemetry/api'

/**
 * Traced decorator for class methods
 * Wraps method execution in an OpenTelemetry span with automatic error handling
 */
export function Traced(spanName?: string) {
  return function(_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>
    descriptor.value = async function(this: BaseHandler<unknown, unknown>, ...args: unknown[]) {
      const name = spanName || this.operationName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
      const span = startSpan(name)
      try {
        const result = await originalMethod.apply(this, args)
        endSpan(span)
        return result
      } catch (error) {
        endSpan(span, error as Error)
        throw error
      }
    }
    return descriptor
  }
}

/**
 * InjectContext decorator for class methods
 * Injects Lambda context into the logger for each invocation
 */
export function InjectContext() {
  return function(_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as (event: unknown, context: Context) => Promise<unknown>
    descriptor.value = async function(this: BaseHandler<unknown, unknown>, event: unknown, context: Context) {
      logger.addContext(context)
      logger.appendKeys({operationName: this.operationName})
      return originalMethod.call(this, event, context)
    }
    return descriptor
  }
}

/**
 * LogMetrics decorator for class methods
 * Automatically publishes stored metrics after method execution
 */
export function LogMetrics(options?: {captureColdStartMetric?: boolean}) {
  let isColdStart = true
  return function(_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>
    descriptor.value = async function(this: BaseHandler<unknown, unknown>, ...args: unknown[]) {
      if (options?.captureColdStartMetric && isColdStart) {
        metrics.addMetric('ColdStart', MetricUnit.Count, 1)
        isColdStart = false
      }
      try {
        const result = await originalMethod.apply(this, args)
        return result
      } finally {
        if (process.env['LOG_LEVEL'] !== 'SILENT') {
          metrics.publishStoredMetrics()
        }
      }
    }
    return descriptor
  }
}

/**
 * Abstract base handler for AWS Lambda functions
 * All Lambda handlers should extend this class
 *
 * TEvent - The event type this handler receives
 * TResult - The result type this handler returns
 */
export abstract class BaseHandler<TEvent, TResult> {
  /** Operation name used for metrics and span naming */
  abstract readonly operationName: string
  /** Active span for the current invocation (set by Traced decorator) */
  protected span: Span | null = null

  /**
   * Main handler entry point with decorators applied
   * Decorators execute in order: LogMetrics then InjectContext then Traced then handler
   */
  @LogMetrics({captureColdStartMetric: true})
  @InjectContext()
  @Traced()
  public async handler(event: TEvent, context: Context): Promise<TResult> {
    metrics.addMetric(`${this.operationName}Attempt`, MetricUnit.Count, 1)
    logger.info('Handler invoked', {operationName: this.operationName})
    try {
      const result = await this.execute(event, context)
      metrics.addMetric(`${this.operationName}Success`, MetricUnit.Count, 1)
      return result
    } catch (error) {
      logger.error('Handler failed', {error, operationName: this.operationName})
      throw error
    }
  }

  /**
   * Execute the handler business logic
   * Subclasses must implement this method
   */
  protected abstract execute(event: TEvent, context: Context): Promise<TResult>

  /** Add an annotation to the current span (indexed and searchable in X-Ray) */
  protected addAnnotation(key: string, value: string): void {
    addAnnotation(this.span, key, value)
  }

  /** Add metadata to the current span (stored but not indexed) */
  protected addMetadata(key: string, value: unknown): void {
    addMetadata(this.span, key, value)
  }
}

export { logger, metrics, MetricUnit }
