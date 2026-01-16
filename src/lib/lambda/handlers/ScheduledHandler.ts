/**
 * Scheduled Handler Base Class
 *
 * Base class for CloudWatch scheduled event handlers (cron/rate expressions).
 * Provides logging of schedule source and standard observability.
 */
import type {Context, ScheduledEvent} from 'aws-lambda'
import {BaseHandler, InjectContext, logger, LogMetrics, metrics, MetricUnit, Traced} from './BaseHandler'
import {addAnnotation} from '#lib/vendor/OpenTelemetry'
import type {Span} from '@opentelemetry/api'

/** Result type for scheduled handlers */
export interface ScheduledResult {
  /** Number of items processed */
  processed?: number
  /** Number of items deleted/cleaned up */
  deleted?: number
  /** Any additional result data */
  [key: string]: unknown
}

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
 * @example
 * ```typescript
 * interface MyCleanupResult {
 *   devicesChecked: number
 *   devicesPruned: number
 *   errors: string[]
 * }
 *
 * class PruneDevicesHandler extends ScheduledHandler<MyCleanupResult> {
 *   readonly operationName = 'PruneDevices'
 *
 *   protected async executeScheduled(event, context): Promise<MyCleanupResult> {
 *     const devices = await getInactiveDevices()
 *     await deleteDevices(devices)
 *     return {devicesChecked: devices.length, devicesPruned: devices.length, errors: []}
 *   }
 * }
 *
 * const handlerInstance = new PruneDevicesHandler()
 * export const handler = handlerInstance.handler.bind(handlerInstance)
 * ```
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
