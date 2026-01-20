import type {AuthorizerParams, EventHandlerParams, WrapperMetadata} from '#types/lambda'
import type {APIGatewayRequestAuthorizerEvent, Context, CustomAuthorizerResult, S3Event, S3EventRecord, SQSEvent, SQSRecord} from 'aws-lambda'
import {logDebug, logError} from '#lib/system/logging'
import {logIncomingFixture} from '#lib/system/observability'
import {extractCorrelationId} from '../correlation'
import {logger} from '#lib/vendor/Powertools'

/**
 * Wraps an API Gateway custom authorizer with proper error propagation.
 * Lets `Error('Unauthorized')` propagate (→401), logs unexpected errors.
 *
 * @param handler - Authorizer business logic
 * @returns Wrapped authorizer handler
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Lambda-Middleware-Patterns#wrapAuthorizer | Usage Examples}
 */
export function wrapAuthorizer(
  handler: (params: AuthorizerParams) => Promise<CustomAuthorizerResult>
): (event: APIGatewayRequestAuthorizerEvent, context: Context, metadata?: WrapperMetadata) => Promise<CustomAuthorizerResult> {
  return async (event: APIGatewayRequestAuthorizerEvent, context: Context, metadata?: WrapperMetadata): Promise<CustomAuthorizerResult> => {
    const {traceId, correlationId} = metadata || extractCorrelationId(event, context)
    logger.appendKeys({correlationId, traceId})
    logIncomingFixture(event)
    try {
      const result = await handler({event, context, metadata: {traceId, correlationId}})
      logDebug('response =>', result)
      return result
    } catch (error) {
      // Let 'Unauthorized' errors propagate (API Gateway returns 401)
      if (error instanceof Error && error.message === 'Unauthorized') {
        throw error
      }
      // Log unexpected errors and rethrow
      logError('authorizer error', error)
      throw error
    }
  }
}

/**
 * Wraps an S3/SQS event handler with per-record error handling.
 * Processes all records even if some fail, logs errors per record.
 *
 * @param handler - Handler for individual records
 * @param options - Configuration with getRecords extractor function
 * @returns Wrapped handler that processes all records
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Lambda-Middleware-Patterns#wrapEventHandler | Usage Examples}
 */
export function wrapEventHandler<TEvent, TRecord>(
  handler: (params: EventHandlerParams<TRecord>) => Promise<void>,
  options: {getRecords: (event: TEvent) => TRecord[]}
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<void> {
  return async (event: TEvent, context: Context, metadata?: WrapperMetadata): Promise<void> => {
    const {traceId, correlationId} = metadata || extractCorrelationId(event, context)
    logger.appendKeys({correlationId, traceId})
    logIncomingFixture(event)
    const records = options.getRecords(event)
    const errors: Error[] = []

    for (const record of records) {
      try {
        await handler({record, context, metadata: {traceId, correlationId}})
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        logError('record processing error', {record, error: err.message})
        errors.push(err)
      }
    }

    if (errors.length > 0) {
      logError(`${errors.length}/${records.length} records failed`, errors.map((e) => e.message))
    }
  }
}

/**
 * Convenience extractor for S3 event records
 */
export const s3Records = (event: S3Event): S3EventRecord[] => event.Records

/**
 * Convenience extractor for SQS event records
 */
export const sqsRecords = (event: SQSEvent): SQSRecord[] => event.Records
