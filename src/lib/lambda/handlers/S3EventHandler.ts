/**
 * S3 Event Handler Base Class
 *
 * Base class for S3 event processing handlers.
 * Processes each S3 record individually, continuing even if some fail.
 */
import type {Context, S3Event} from 'aws-lambda'
import type {S3RecordContext} from '#types/lambda'
import {BaseHandler, InjectContext, logger, LogMetrics, metrics, MetricUnit, Traced} from './BaseHandler'
import {extractCorrelationId} from '../correlation'
import {logIncomingFixture} from '#lib/system/observability'
import {addAnnotation, addMetadata, type Span} from '#lib/vendor/OpenTelemetry'

/**
 * Abstract base class for S3 event processing handlers
 *
 * Provides:
 * - Per-record error handling with failure logging
 * - Continues processing all records even if some fail
 * - Correlation ID tracking
 * - Processing statistics in metrics
 *
 * @example See S3ObjectCreated Lambda for a complete implementation example
 */
export abstract class S3EventHandler extends BaseHandler<S3Event, void> {
  /** Active span for tracing */
  protected span: Span | null = null

  /** Main handler entry point with decorators applied */
  @LogMetrics({captureColdStartMetric: true})
  @InjectContext()
  @Traced()
  public async handler(event: S3Event, context: Context): Promise<void> {
    metrics.addMetric(`${this.operationName}Attempt`, MetricUnit.Count, 1)
    logger.info('Handler invoked', {operationName: this.operationName, recordCount: event.Records.length})
    try {
      await this.execute(event, context)
      metrics.addMetric(`${this.operationName}Success`, MetricUnit.Count, 1)
    } catch (error) {
      logger.error('Handler failed', {error, operationName: this.operationName})
      throw error
    }
  }

  /** Execute S3 event processing - iterates through records, processes each */
  protected async execute(event: S3Event, context: Context): Promise<void> {
    const {traceId, correlationId} = extractCorrelationId(event, context)
    logger.appendKeys({correlationId, traceId})
    logIncomingFixture(event)
    addAnnotation(this.span, 'correlationId', correlationId)
    addMetadata(this.span, 'recordCount', event.Records.length)

    const errors: Error[] = []

    for (const record of event.Records) {
      try {
        await this.processRecord({record, context, metadata: {traceId, correlationId}})
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        logger.error('S3 record processing failed', {key: record.s3?.object?.key, error: err.message})
        errors.push(err)
      }
    }

    addMetadata(this.span, 'succeeded', event.Records.length - errors.length)
    addMetadata(this.span, 'failed', errors.length)

    if (errors.length > 0) {
      logger.info('S3 event processing completed with failures', {
        total: event.Records.length,
        failed: errors.length,
        succeeded: event.Records.length - errors.length
      })
      metrics.addMetric(`${this.operationName}Failed`, MetricUnit.Count, errors.length)
    } else {
      logger.info('S3 event processing completed', {total: event.Records.length})
    }
  }

  /**
   * Process a single S3 event record
   * Subclasses must implement this method
   */
  protected abstract processRecord(ctx: S3RecordContext): Promise<void>
}
