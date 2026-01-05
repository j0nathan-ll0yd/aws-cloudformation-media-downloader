import middy from '@middy/core'
import {injectLambdaContext, logger, metrics, MetricUnit} from '#lib/vendor/Powertools'
import type {Context} from 'aws-lambda'
import {getOptionalEnv} from '#lib/system/env'
import {securityHeaders} from './securityHeaders'

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
 * - Auto-flush custom metrics when present (no configuration needed)
 * - Correlation IDs through all logs
 * - Security headers on all responses (X-Content-Type-Options, X-Frame-Options, etc.)
 *
 * Note: Tracing is now provided by the ADOT Lambda layer and OpenTelemetry.
 * The layer auto-instruments AWS SDK calls - no manual SDK initialization needed.
 *
 * @param handler - Lambda handler function
 * @returns Wrapped handler with Powertools middleware
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Lambda-Middleware-Patterns#withPowertools | Usage Examples}
 */
export function withPowertools<TEvent, TResult>(
  handler: (event: TEvent, context: Context) => Promise<TResult>
): (event: TEvent, context: Context) => Promise<TResult> {
  const isTestEnv = getOptionalEnv('NODE_ENV', 'development') === 'test'

  const middyHandler = middy(handler).use(injectLambdaContext(logger, {clearState: true})).use(securityHeaders())

  // Cold start tracking (before handler)
  middyHandler.before(async () => {
    if (isColdStart) {
      if (process.env.LOG_LEVEL !== 'SILENT') {
        metrics.addMetric('ColdStart', MetricUnit.Count, 1)
      }
      isColdStart = false
    }
  })

  // Auto-flush metrics if any were added (after handler or on error)
  // Only in non-test environments to avoid EMF output during tests
  if (!isTestEnv) {
    const publishMetrics = async () => {
      if (process.env.LOG_LEVEL !== 'SILENT' && metrics.hasStoredMetrics()) {
        metrics.publishStoredMetrics()
      }
    }
    middyHandler.after(publishMetrics)
    middyHandler.onError(publishMetrics)
  }

  return middyHandler as unknown as (event: TEvent, context: Context) => Promise<TResult>
}

// Re-export Powertools utilities for direct access
export { logger, metrics, MetricUnit }
