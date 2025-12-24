import middy from '@middy/core'
import {injectLambdaContext, logger, logMetrics, metrics, MetricUnit} from '#lib/vendor/Powertools'
import type {Context} from 'aws-lambda'
import {getOptionalEnv} from '#lib/system/env'
import type {PowertoolsOptions} from '#types/lambda'

/**
 * Wraps a Lambda handler with AWS Powertools middleware stack.
 * Provides enhanced observability with structured logging, tracing, and metrics.
 *
 * Features:
 * - Structured JSON logging with automatic context enrichment
 * - OpenTelemetry tracing via ADOT Lambda layer (automatic)
 * - Optional cold start metric tracking (opt-in via enableMetrics)
 * - Correlation IDs through all logs
 *
 * Note: Tracing is now provided by the ADOT Lambda layer and OpenTelemetry.
 * The layer auto-instruments AWS SDK calls - no manual SDK initialization needed.
 *
 * @param handler - Lambda handler function
 * @param options - Optional configuration (e.g., enableMetrics for lambdas with custom metrics)
 * @returns Wrapped handler with Powertools middleware
 *
 * @example
 * ```typescript
 * // Standard usage (no metrics - default for most lambdas)
 * export const handler = withPowertools(wrapAuthenticatedHandler(
 *   async ({event, context, userId}) => {
 *     const files = await getFilesByUser(userId)
 *     return response(context, 200, files)
 *   }
 * ))
 *
 * // Enable metrics for lambdas that publish custom metrics
 * export const handler = withPowertools(wrapScheduledHandler(
 *   async ({event, context}) => {
 *     metrics.addMetric('FilesProcessed', MetricUnit.Count, filesProcessed)
 *     return result
 *   }
 * ), {enableMetrics: true})
 * ```
 */
export function withPowertools<TEvent, TResult>(
  handler: (event: TEvent, context: Context) => Promise<TResult>,
  options?: PowertoolsOptions
): (event: TEvent, context: Context) => Promise<TResult> {
  const middyHandler = middy(handler).use(injectLambdaContext(logger, {clearState: true}))

  // Enable metrics middleware only when:
  // 1. Explicitly enabled via enableMetrics option (for lambdas that publish custom metrics)
  // 2. Not running in test environment (prevents warnings in Jest)
  const shouldEnableMetrics = options?.enableMetrics && getOptionalEnv('NODE_ENV', 'development') !== 'test'

  if (shouldEnableMetrics) {
    middyHandler.use(logMetrics(metrics, {captureColdStartMetric: true}))
  }

  return middyHandler as unknown as (event: TEvent, context: Context) => Promise<TResult>
}

// Re-export Powertools utilities for direct access
export { logger, metrics, MetricUnit }
