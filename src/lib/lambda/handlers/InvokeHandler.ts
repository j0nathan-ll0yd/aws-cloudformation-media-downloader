/**
 * Invoke Handler Base Class
 *
 * Base class for Lambda handlers invoked directly (not via API Gateway/SQS/Schedule).
 * Used for manual invocation or Lambda-to-Lambda calls.
 */
import type {Context} from 'aws-lambda'
import {BaseHandler, InjectContext, logger, LogMetrics, metrics, MetricUnit, Traced} from './BaseHandler'
import type {Span} from '#lib/vendor/OpenTelemetry'

/**
 * Abstract base class for directly invoked Lambda handlers
 *
 * Provides:
 * - Standard observability (metrics, traces)
 * - Generic input/output type support
 * - Suitable for manual invocation or Lambda-to-Lambda calls
 *
 * TInput - The expected input type
 * TResult - The result type returned
 *
 * @example See MigrateDSQL Lambda for a complete implementation example
 */
export abstract class InvokeHandler<TInput = unknown, TResult = unknown> extends BaseHandler<TInput, TResult> {
  /** Active span for tracing */
  protected span: Span | null = null

  /** Main handler entry point with decorators applied */
  @LogMetrics({captureColdStartMetric: true})
  @InjectContext()
  @Traced()
  public async handler(event: TInput, context: Context): Promise<TResult> {
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

  /** Execute the invoke handler - delegates to executeInvoke */
  protected async execute(event: TInput, context: Context): Promise<TResult> {
    return this.executeInvoke(event, context)
  }

  /**
   * Execute the invoked task
   * Subclasses must implement this method
   */
  protected abstract executeInvoke(event: TInput, context: Context): Promise<TResult>
}
