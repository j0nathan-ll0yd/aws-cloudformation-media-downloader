/**
 * AWS Lambda Powertools configuration
 * Centralized observability utilities for Lambda functions
 * @see https://docs.aws.amazon.com/powertools/typescript/latest/
 */
import {Logger} from '@aws-lambda-powertools/logger'
import {injectLambdaContext} from '@aws-lambda-powertools/logger/middleware'
import {Tracer} from '@aws-lambda-powertools/tracer'
import {captureLambdaHandler} from '@aws-lambda-powertools/tracer/middleware'
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
 * Powertools Tracer instance
 * Enhanced X-Ray tracing with automatic subsegment creation
 */
export const tracer = new Tracer({serviceName: process.env['AWS_LAMBDA_FUNCTION_NAME'] || 'MediaDownloader'})

/**
 * Powertools Metrics instance
 * CloudWatch embedded metrics format (EMF) for custom metrics
 */
export const metrics = new Metrics({namespace: 'MediaDownloader', serviceName: process.env['AWS_LAMBDA_FUNCTION_NAME'] || 'MediaDownloader'})

// Re-export middleware functions for use with middy
export { injectLambdaContext, captureLambdaHandler, logMetrics, MetricUnit }
