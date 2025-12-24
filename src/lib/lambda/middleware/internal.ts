import type {LambdaInvokeHandlerParams, ScheduledHandlerParams, WrapperMetadata} from '#types/lambda'
import type {Context, ScheduledEvent} from 'aws-lambda'
import {logError, logInfo} from '#lib/system/logging'
import {logIncomingFixture, logOutgoingFixture} from '#lib/system/observability'

/**
 * Wraps a CloudWatch scheduled event handler with logging.
 * Logs event and result, rethrows errors for CloudWatch visibility.
 *
 * @param handler - Scheduled event business logic
 * @returns Wrapped handler with logging
 *
 * @example
 * ```typescript
 * export const handler = withXRay(wrapScheduledHandler(async () => {
 *   // Scheduled task logic
 *   await pruneOldRecords()
 * }))
 * ```
 */
export function wrapScheduledHandler<TResult = void>(
  handler: (params: ScheduledHandlerParams) => Promise<TResult>
): (event: ScheduledEvent, context: Context, metadata?: WrapperMetadata) => Promise<TResult> {
  return async (event: ScheduledEvent, context: Context, metadata?: WrapperMetadata): Promise<TResult> => {
    const traceId = metadata?.traceId || context.awsRequestId
    logIncomingFixture(event)
    try {
      const result = await handler({event, context, metadata: {traceId}})
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
 *
 * @example
 * ```typescript
 * export const handler = withPowertools(wrapLambdaInvokeHandler(
 *   async ({event, context}) => {
 *     // Process the Lambda invocation event
 *     await processFile(event.fileId)
 *     return buildApiResponse(context, 200, {status: 'success'})
 *   }
 * ))
 * ```
 */
export function wrapLambdaInvokeHandler<TEvent, TResult>(
  handler: (params: LambdaInvokeHandlerParams<TEvent>) => Promise<TResult>
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<TResult> {
  return async (event: TEvent, context: Context, metadata?: WrapperMetadata): Promise<TResult> => {
    const traceId = metadata?.traceId || context.awsRequestId
    logIncomingFixture(event)
    try {
      const result = await handler({event, context, metadata: {traceId}})
      logOutgoingFixture(result)
      return result
    } catch (error) {
      logError('lambda invoke handler error', error)
      throw error
    }
  }
}
