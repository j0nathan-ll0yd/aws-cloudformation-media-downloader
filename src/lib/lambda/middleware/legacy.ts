import type {AuthorizerParams, EventHandlerParams, WrapperMetadata} from '#types/lambda'
import type {APIGatewayRequestAuthorizerEvent, Context, CustomAuthorizerResult, S3Event, S3EventRecord, SQSEvent, SQSRecord} from 'aws-lambda'
import {logDebug, logError} from '#lib/system/logging'
import {logIncomingFixture} from '#lib/system/observability'

/**
 * Wraps an API Gateway custom authorizer with proper error propagation.
 * Lets `Error('Unauthorized')` propagate (→401), logs unexpected errors.
 *
 * @param handler - Authorizer business logic
 * @returns Wrapped authorizer handler
 *
 * @example
 * ```typescript
 * export const handler = withXRay(wrapAuthorizer(async ({event}) => {
 *   if (!valid) throw new Error('Unauthorized')  // → 401
 *   return generateAllow(userId, event.methodArn)
 * }))
 * ```
 */
export function wrapAuthorizer(
  handler: (params: AuthorizerParams) => Promise<CustomAuthorizerResult>
): (event: APIGatewayRequestAuthorizerEvent, context: Context, metadata?: WrapperMetadata) => Promise<CustomAuthorizerResult> {
  return async (event: APIGatewayRequestAuthorizerEvent, context: Context, metadata?: WrapperMetadata): Promise<CustomAuthorizerResult> => {
    const traceId = metadata?.traceId || context.awsRequestId
    logIncomingFixture(event)
    try {
      const result = await handler({event, context, metadata: {traceId}})
      logDebug('response ==', result)
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
 * @param options.getRecords
 * @returns Wrapped handler that processes all records
 *
 * @example
 * ```typescript
 * export const handler = withXRay(wrapEventHandler(
 *   async ({record}) => {
 *     // Process single S3 record
 *     await processFile(record.s3.object.key)
 *   },
 *   {getRecords: s3Records}
 * ))
 * ```
 */
export function wrapEventHandler<TEvent, TRecord>(
  handler: (params: EventHandlerParams<TRecord>) => Promise<void>,
  options: {getRecords: (event: TEvent) => TRecord[]}
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<void> {
  return async (event: TEvent, context: Context, metadata?: WrapperMetadata): Promise<void> => {
    const traceId = metadata?.traceId || context.awsRequestId
    logIncomingFixture(event)
    const records = options.getRecords(event)
    const errors: Error[] = []

    for (const record of records) {
      try {
        await handler({record, context, metadata: {traceId}})
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
 * @param event
 */
export const s3Records = (event: S3Event): S3EventRecord[] => event.Records

/**
 * Convenience extractor for SQS event records
 * @param event
 */
export const sqsRecords = (event: SQSEvent): SQSRecord[] => event.Records
