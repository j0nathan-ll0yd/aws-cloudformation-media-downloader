import type {LambdaInvokeHandlerParams, ScheduledHandlerParams, WrapperMetadata} from '#types/lambda'
import type {Context, ScheduledEvent} from 'aws-lambda'
import {logError, logInfo} from '#lib/system/logging'
import {logIncomingFixture, logOutgoingFixture} from '#lib/system/observability'
import {extractCorrelationId} from '../correlation'
import {logger} from '#lib/vendor/Powertools'

/**
 * Wraps a CloudWatch scheduled event handler with logging.
 * Logs event and result, rethrows errors for CloudWatch visibility.
 *
 * @param handler - Scheduled event business logic
 * @returns Wrapped handler with logging
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/TypeScript/Lambda-Middleware-Patterns#wrapScheduledHandler | Usage Examples}
 */
export function wrapScheduledHandler<TResult = void>(
  handler: (params: ScheduledHandlerParams) => Promise<TResult>
): (event: ScheduledEvent, context: Context, metadata?: WrapperMetadata) => Promise<TResult> {
  return async (event: ScheduledEvent, context: Context, metadata?: WrapperMetadata): Promise<TResult> => {
    const {traceId, correlationId} = metadata || extractCorrelationId(event, context)
    logger.appendKeys({correlationId, traceId})
    logIncomingFixture(event)
    try {
      const result = await handler({event, context, metadata: {traceId, correlationId}})
      logInfo('scheduled result =>', result as object)
      return result
    } catch (error) {
      logError('scheduled handler error', error)
      throw error
    }
  }
}

/**
 * Wraps a Lambda-to-Lambda invoke handler with logging and error handling.
 * Used for handlers invoked asynchronously by other Lambdas (e.g., StartFileUpload).
 * Provides consistent logging, fixture extraction, and error propagation.
 *
 * @param handler - Lambda invoke handler business logic
 * @returns Wrapped handler with logging and error handling
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/TypeScript/Lambda-Middleware-Patterns#wrapLambdaInvokeHandler | Usage Examples}
 */
export function wrapLambdaInvokeHandler<TEvent, TResult>(
  handler: (params: LambdaInvokeHandlerParams<TEvent>) => Promise<TResult>
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<TResult> {
  return async (event: TEvent, context: Context, metadata?: WrapperMetadata): Promise<TResult> => {
    const {traceId, correlationId} = metadata || extractCorrelationId(event, context)
    logger.appendKeys({correlationId, traceId})
    logIncomingFixture(event)
    try {
      const result = await handler({event, context, metadata: {traceId, correlationId}})
      logOutgoingFixture(result)
      return result
    } catch (error) {
      logError('lambda invoke handler error', error)
      throw error
    }
  }
}
