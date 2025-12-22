/**
 * AWS Lambda Powertools configuration
 * Centralized observability utilities for Lambda functions
 *
 * NOTE: Tracer has been replaced with OpenTelemetry for native ESM support.
 * Use #lib/vendor/OpenTelemetry for tracing functionality.
 *
 * @see https://docs.aws.amazon.com/powertools/typescript/latest/
 */
import {Logger} from '@aws-lambda-powertools/logger'
import {injectLambdaContext} from '@aws-lambda-powertools/logger/middleware'
import {Metrics, MetricUnit} from '@aws-lambda-powertools/metrics'
import {logMetrics} from '@aws-lambda-powertools/metrics/middleware'

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT'

/**
 * Powertools Logger instance
 * Provides structured JSON logging with automatic context enrichment
 */
export const logger = new Logger({
  serviceName: process.env['AWS_LAMBDA_FUNCTION_NAME'] || 'MediaDownloader',
  logLevel: (process.env['LOG_LEVEL'] as LogLevel) || 'INFO',
  persistentLogAttributes: {environment: process.env['ENVIRONMENT'] || 'production'}
})

/**
 * Powertools Metrics instance
 * CloudWatch embedded metrics format (EMF) for custom metrics
 */
export const metrics = new Metrics({namespace: 'MediaDownloader', serviceName: process.env['AWS_LAMBDA_FUNCTION_NAME'] || 'MediaDownloader'})

// Re-export middleware functions for use with middy
export {injectLambdaContext, logMetrics, MetricUnit}
