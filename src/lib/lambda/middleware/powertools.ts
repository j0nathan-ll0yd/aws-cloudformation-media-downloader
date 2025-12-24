import middy from '@middy/core'
import {injectLambdaContext, logger, logMetrics, metrics, MetricUnit} from '#lib/vendor/Powertools'
import type {Context} from 'aws-lambda'
import {getOptionalEnv} from '#lib/system/env'
import type {PowertoolsOptions} from '#types/lambda'

/**
 * Module-level cold start flag.
 * True on first invocation per Lambda instance, false thereafter.
 *
 * FUTURE CONCERN: This manual cold start tracking duplicates logic from Powertools
 * logMetrics middleware. If Powertools changes how cold start metrics work (metric
 * name, dimensions, format), this code won't automatically pick up those changes.
 * Monitor Powertools changelog when upgrading: https://docs.powertools.aws.dev/lambda/typescript/latest/changelog/
 */
let isColdStart = true

/**
 * Wraps a Lambda handler with AWS Powertools middleware stack.
 * Provides enhanced observability with structured logging, tracing, and metrics.
 *
 * Features:
 * - Structured JSON logging with automatic context enrichment
 * - OpenTelemetry tracing via ADOT Lambda layer (automatic)
 * - Automatic cold start metric tracking (ALL lambdas)
 * - Optional custom metrics publishing (opt-in via enableCustomMetrics)
 * - Correlation IDs through all logs
 *
 * Note: Tracing is now provided by the ADOT Lambda layer and OpenTelemetry.
 * The layer auto-instruments AWS SDK calls - no manual SDK initialization needed.
 *
 * @param handler - Lambda handler function
 * @param options - Optional configuration (e.g., enableCustomMetrics for lambdas with custom metrics)
 * @returns Wrapped handler with Powertools middleware
 *
 * @example
 * ```typescript
 * // Standard usage - cold start tracked automatically, no custom metrics
 * export const handler = withPowertools(wrapAuthenticatedHandler(
 *   async ({event, context, userId}) => {
 *     const files = await getFilesByUser(userId)
 *     return response(context, 200, files)
 *   }
 * ))
 *
 * // Enable custom metrics for lambdas that publish them
 * export const handler = withPowertools(wrapScheduledHandler(
 *   async ({event, context}) => {
 *     metrics.addMetric('FilesProcessed', MetricUnit.Count, filesProcessed)
 *     return result
 *   }
 * ), {enableCustomMetrics: true})
 * ```
 */
export function withPowertools<TEvent, TResult>(
  handler: (event: TEvent, context: Context) => Promise<TResult>,
  options?: PowertoolsOptions
): (event: TEvent, context: Context) => Promise<TResult> {
  const middyHandler = middy(handler).use(injectLambdaContext(logger, {clearState: true}))

  // Check if we should enable full metrics middleware (for custom metrics)
  // Only enable when explicitly requested AND not in test environment
  const shouldEnableFullMetrics = options?.enableCustomMetrics && getOptionalEnv('NODE_ENV', 'development') !== 'test'

  if (shouldEnableFullMetrics) {
    // Full metrics middleware: handles both cold start and custom metrics flushing
    middyHandler.use(logMetrics(metrics, {captureColdStartMetric: true}))
  } else {
    // Manual cold start tracking only - no flush, no warning, no empty EMF blobs
    // This ensures ALL lambdas report cold starts without the "No application metrics" warning
    middyHandler.before(async () => {
      if (isColdStart) {
        metrics.addMetric('ColdStart', MetricUnit.Count, 1)
        metrics.publishStoredMetrics()
        isColdStart = false
      }
    })
  }

  return middyHandler as unknown as (event: TEvent, context: Context) => Promise<TResult>
}

// Re-export Powertools utilities for direct access
export { logger, metrics, MetricUnit }
