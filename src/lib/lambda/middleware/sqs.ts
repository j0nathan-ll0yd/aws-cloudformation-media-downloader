import type {SqsBatchOptions, SqsRecordParams, WrapperMetadata} from '#types/lambda'
import type {Context, SQSBatchResponse, SQSEvent} from 'aws-lambda'
import {logError, logInfo} from '#lib/system/logging'
import {logIncomingFixture} from '#lib/system/observability'
import {extractCorrelationId} from '../correlation'
import {logger} from '#lib/vendor/Powertools'

/**
 * Wraps an SQS event handler with standardized batch processing and partial failure support.
 * Processes each record individually, collecting failures and returning them for SQS retry.
 *
 * Features:
 * - Automatic JSON body parsing (configurable)
 * - Per-record error handling with failure collection
 * - Partial batch failure support via SQSBatchResponse
 * - Correlation ID tracking per record
 * - Batch processing statistics logging
 *
 * @param handler - Handler function to process each SQS record
 * @param options - Configuration options for batch processing
 * @returns Wrapped handler that returns SQSBatchResponse with failed message IDs
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Lambda-Middleware-Patterns#wrapSqsBatchHandler | Usage Examples}
 */
export function wrapSqsBatchHandler<TBody = unknown>(
  handler: (params: SqsRecordParams<TBody>) => Promise<void>,
  options: SqsBatchOptions = {}
): (event: SQSEvent, context: Context, metadata?: WrapperMetadata) => Promise<SQSBatchResponse> {
  const {parseBody = true, stopOnError = false} = options
  return async (event: SQSEvent, context: Context, metadata?: WrapperMetadata): Promise<SQSBatchResponse> => {
    const {traceId, correlationId} = metadata || extractCorrelationId(event, context)
    logger.appendKeys({correlationId, traceId})
    logIncomingFixture(event)

    const batchItemFailures: {itemIdentifier: string}[] = []

    for (const record of event.Records) {
      try {
        let body: TBody
        if (parseBody) {
          try {
            body = JSON.parse(record.body) as TBody
          } catch (parseError) {
            const message = parseError instanceof Error ? parseError.message : String(parseError)
            logError('SQS record JSON parse failed', {messageId: record.messageId, error: message})
            batchItemFailures.push({itemIdentifier: record.messageId})
            if (stopOnError) {
              break
            }
            continue
          }
        } else {
          body = record.body as unknown as TBody
        }

        await handler({record, body, context, metadata: {traceId, correlationId}, messageAttributes: record.messageAttributes})
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logError('SQS record processing failed', {messageId: record.messageId, error: message})
        batchItemFailures.push({itemIdentifier: record.messageId})

        if (stopOnError) {
          break
        }
      }
    }

    const succeeded = event.Records.length - batchItemFailures.length
    if (batchItemFailures.length > 0) {
      logInfo('SQS batch processing completed with failures', {total: event.Records.length, failed: batchItemFailures.length, succeeded})
    } else {
      logInfo('SQS batch processing completed', {total: event.Records.length, succeeded})
    }

    return {batchItemFailures}
  }
}
