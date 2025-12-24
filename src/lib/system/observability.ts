import {getStandardUnit, putMetricData} from '#lib/vendor/AWS/CloudWatch'
import type {MetricInput} from '#types/util'
import {getOptionalEnv} from '#lib/system/env'
import {getRequestSummary, logDebug, logError, logInfo, logger} from '#lib/system/logging'
import {sanitizeData} from '#util/security'

/**
 * Publish a custom CloudWatch metric
 * @param metricName - Name of the metric
 * @param value - Numeric value
 * @param unit - Unit of measurement (Seconds, Bytes, Count, etc.)
 * @param dimensions - Optional dimensions for filtering/grouping
 */
export async function putMetric(metricName: string, value: number, unit?: string, dimensions: {Name: string; Value: string}[] = []): Promise<void> {
  try {
    await putMetricData({
      Namespace: 'MediaDownloader',
      MetricData: [{MetricName: metricName, Value: value, Unit: getStandardUnit(unit), Timestamp: new Date(), Dimensions: dimensions}]
    })
    logDebug(`Published metric: ${metricName}`, {value, unit: unit || 'Count', dimensions})
  } catch (error) {
    // Don't fail Lambda execution if metrics fail
    logError('Failed to publish CloudWatch metric', {metricName, error})
  }
}

/**
 * Publish multiple metrics in a single API call for efficiency
 * @param metrics - Array of metrics to publish
 */
export async function putMetrics(metrics: MetricInput[]): Promise<void> {
  try {
    await putMetricData({
      Namespace: 'MediaDownloader',
      MetricData: metrics.map((m) => ({
        MetricName: m.name,
        Value: m.value,
        Unit: getStandardUnit(m.unit),
        Timestamp: new Date(),
        Dimensions: m.dimensions || []
      }))
    })
    logDebug(`Published ${metrics.length} metrics`, {metrics: metrics.map((m) => m.name)})
  } catch (error) {
    // Don't fail Lambda execution if metrics fail
    logError('Failed to publish CloudWatch metrics', error)
  }
}

/**
 * Log incoming request for fixture extraction from CloudWatch
 * Marks production requests for automated fixture generation
 *
 * Also logs a compact request summary at INFO level for human-readable logs.
 * Full event is logged with __FIXTURE_MARKER__ for automated fixture extraction.
 *
 * Automatically detects the Lambda function name from AWS_LAMBDA_FUNCTION_NAME
 * environment variable (set by AWS Lambda runtime).
 *
 * @param event - Lambda event (API Gateway request)
 * @param fixtureType - Optional type identifier (auto-detected from Lambda name if not provided)
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Fixture-Extraction#fixture-logging-implementation | Fixture Logging Implementation}
 */
export function logIncomingFixture(event: unknown, fixtureType?: string): void {
  // Log compact request summary for human-readable logs (~150 bytes vs ~2.5KB full event)
  logInfo('request <=', getRequestSummary(event))

  // Silence fixture logging during tests if LOG_LEVEL is SILENT
  if (getOptionalEnv('LOG_LEVEL', 'INFO').toUpperCase() === 'SILENT') {
    return
  }
  const detectedType = fixtureType || getOptionalEnv('AWS_LAMBDA_FUNCTION_NAME', 'UnknownLambda')
  // Use Powertools logger for consistent JSON formatting (enables CloudWatch pretty-printing)
  // Note: 'timestamp' is a reserved Powertools key, so we use 'capturedAt' instead
  logger.info('fixture:incoming', {__FIXTURE_MARKER__: 'INCOMING', fixtureType: detectedType, capturedAt: Date.now(), event: sanitizeData(event)})
}

/**
 * Log outgoing response for fixture extraction from CloudWatch
 * Marks production responses for automated fixture generation
 *
 * Automatically detects the Lambda function name from AWS_LAMBDA_FUNCTION_NAME
 * environment variable (set by AWS Lambda runtime).
 *
 * @param response - Lambda response
 * @param fixtureType - Optional type identifier (auto-detected from Lambda name if not provided)
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Fixture-Extraction#fixture-logging-implementation | Fixture Logging Implementation}
 */
export function logOutgoingFixture(response: unknown, fixtureType?: string): void {
  // Silence fixture logging during tests if LOG_LEVEL is SILENT
  if (getOptionalEnv('LOG_LEVEL', 'INFO').toUpperCase() === 'SILENT') {
    return
  }
  const detectedType = fixtureType || getOptionalEnv('AWS_LAMBDA_FUNCTION_NAME', 'UnknownLambda')
  // Use Powertools logger for consistent JSON formatting (enables CloudWatch pretty-printing)
  // Note: 'timestamp' is a reserved Powertools key, so we use 'capturedAt' instead
  logger.info('fixture:outgoing', {__FIXTURE_MARKER__: 'OUTGOING', fixtureType: detectedType, capturedAt: Date.now(), response: sanitizeData(response)})
}
