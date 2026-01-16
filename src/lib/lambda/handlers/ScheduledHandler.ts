/**
 * Scheduled Handler Base Class
 *
 * Base class for CloudWatch scheduled event handlers (cron/rate expressions).
 * Provides logging of schedule source and standard observability.
 */
import type {Context, ScheduledEvent} from 'aws-lambda'
import type {ScheduledResult} from '#types/lambda'
import {BaseHandler, InjectContext, logger, LogMetrics, metrics, MetricUnit, Traced} from './BaseHandler'
import {addAnnotation, type Span} from '#lib/vendor/OpenTelemetry'

/**
 * Abstract base class for CloudWatch scheduled event handlers
 *
 * Provides:
 * - Schedule ARN logging and annotation
 * - Standard observability (metrics, traces)
 * - Generic result type support
 *
 * TResult - The result type returned by the scheduled task
 *
 * @example See PruneDevices Lambda for a complete implementation example
 */
export abstract class ScheduledHandler<TResult = ScheduledResult> extends BaseHandler<ScheduledEvent, TResult> {
  /** Active span for tracing */
  protected span: Span | null = null

  /** Main handler entry point with decorators applied */
  @LogMetrics({captureColdStartMetric: true})
  @InjectContext()
  @Traced()
  public async handler(event: ScheduledEvent, context: Context): Promise<TResult> {
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

  /** Execute the scheduled handler - logs schedule information before calling executeScheduled */
  protected async execute(event: ScheduledEvent, context: Context): Promise<TResult> {
    const scheduleArn = event.resources?.[0]
    logger.info('Scheduled execution started', {scheduleArn})
    if (scheduleArn) {
      addAnnotation(this.span, 'scheduleArn', scheduleArn)
    }
    return this.executeScheduled(event, context)
  }

  /**
   * Execute the scheduled task
   * Subclasses must implement this method
   */
  protected abstract executeScheduled(event: ScheduledEvent, context: Context): Promise<TResult>
}
