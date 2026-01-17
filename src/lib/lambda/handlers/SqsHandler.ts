/**
 * SQS Handler Base Class
 *
 * Base class for SQS batch processing handlers with partial failure support.
 * Processes each record individually, collecting failures for SQS retry.
 */
import type {Context, SQSBatchResponse, SQSEvent} from 'aws-lambda'
import type {SqsBatchOptions, SqsRecordContext} from '#types/lambda'
import {BaseHandler, InjectContext, logger, LogMetrics, metrics, MetricUnit, Traced} from './BaseHandler'
import {extractCorrelationId} from '../correlation'
import {logIncomingFixture} from '#lib/system/observability'
import {addAnnotation, addMetadata, type Span} from '#lib/vendor/OpenTelemetry'

/**
 * Abstract base class for SQS batch processing handlers
 *
 * Provides:
 * - Automatic JSON body parsing (configurable)
 * - Per-record error handling with failure collection
 * - Partial batch failure support via SQSBatchResponse
 * - Correlation ID tracking per record
 * - Batch processing statistics in metrics
 *
 * TBody - The expected body type after JSON parsing
 *
 * @example See SendPushNotification Lambda for a complete implementation example
 */
export abstract class SqsHandler<TBody = unknown> extends BaseHandler<SQSEvent, SQSBatchResponse> {
  /** Active span for tracing */
  protected span: Span | null = null
  /** Options for batch processing */
  protected readonly batchOptions: SqsBatchOptions = {parseBody: true, stopOnError: false}

  /** Main handler entry point with decorators applied */
  @LogMetrics({captureColdStartMetric: true})
  @InjectContext()
  @Traced()
  public async handler(event: SQSEvent, context: Context): Promise<SQSBatchResponse> {
    metrics.addMetric(`${this.operationName}Attempt`, MetricUnit.Count, 1)
    logger.info('Handler invoked', {operationName: this.operationName, recordCount: event.Records.length})
    try {
      const result = await this.execute(event, context)
      const succeeded = event.Records.length - result.batchItemFailures.length
      if (succeeded > 0) {
        metrics.addMetric(`${this.operationName}Success`, MetricUnit.Count, succeeded)
      }
      return result
    } catch (error) {
      logger.error('Handler failed', {error, operationName: this.operationName})
      throw error
    }
  }

  /** Execute SQS batch processing - iterates through records, processes each, and collects failures */
  protected async execute(event: SQSEvent, context: Context): Promise<SQSBatchResponse> {
    const {traceId, correlationId} = extractCorrelationId(event, context)
    logger.appendKeys({correlationId, traceId})
    logIncomingFixture(event)
    addAnnotation(this.span, 'correlationId', correlationId)
    addMetadata(this.span, 'recordCount', event.Records.length)

    const batchItemFailures: {itemIdentifier: string}[] = []
    const {parseBody = true, stopOnError = false} = this.batchOptions

    for (const record of event.Records) {
      try {
        let body: TBody
        if (parseBody) {
          try {
            body = JSON.parse(record.body) as TBody
          } catch (parseError) {
            const message = parseError instanceof Error ? parseError.message : String(parseError)
            logger.error('SQS record JSON parse failed', {messageId: record.messageId, error: message})
            batchItemFailures.push({itemIdentifier: record.messageId})
            if (stopOnError) {
              break
            }
            continue
          }
        } else {
          body = record.body as unknown as TBody
        }
        await this.processRecord({record, body, context, metadata: {traceId, correlationId}, messageAttributes: record.messageAttributes})
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('SQS record processing failed', {messageId: record.messageId, error: message})
        batchItemFailures.push({itemIdentifier: record.messageId})
        if (stopOnError) {
          break
        }
      }
    }

    const succeeded = event.Records.length - batchItemFailures.length
    if (batchItemFailures.length > 0) {
      logger.info('SQS batch processing completed with failures', {total: event.Records.length, failed: batchItemFailures.length, succeeded})
      metrics.addMetric(`${this.operationName}Failed`, MetricUnit.Count, batchItemFailures.length)
    } else {
      logger.info('SQS batch processing completed', {total: event.Records.length, succeeded})
    }
    addMetadata(this.span, 'succeeded', succeeded)
    addMetadata(this.span, 'failed', batchItemFailures.length)

    return {batchItemFailures}
  }

  /**
   * Process a single SQS record
   * Subclasses must implement this method
   */
  protected abstract processRecord(ctx: SqsRecordContext<TBody>): Promise<void>
}
