import {getStandardUnit, putMetricData} from '#lib/vendor/AWS/CloudWatch'
import type {MetricInput} from '#types/util'
import {getOptionalEnv} from '#lib/system/env'
import {logDebug, logError} from '#lib/system/logging'

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
 * Sanitize data for test fixtures by removing sensitive fields
 * Recursively processes objects and arrays to redact PII and credentials
 * @param data - Data to sanitize
 * @returns Sanitized copy of data with sensitive fields redacted
 */
export function sanitizeForTest(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForTest(item))
  }

  const sanitized: Record<string, unknown> = {...(data as Record<string, unknown>)}

  // Remove sensitive fields - case-insensitive patterns for comprehensive PII protection
  const sensitivePatterns = [
    /^authorization$/i, // fmt: multiline
    /^token$/i,
    /^deviceToken$/i,
    /^refreshToken$/i,
    /^accessToken$/i,
    /^password$/i,
    /^apiKey$/i,
    /^secret$/i,
    /^privateKey$/i,
    /^appleDeviceIdentifier$/i,
    /^email$/i,
    /^phoneNumber$/i,
    /^phone$/i,
    /^certificate$/i,
    /^ssn$/i,
    /^creditCard$/i
  ]

  for (const key in sanitized) {
    if (sensitivePatterns.some((pattern) => pattern.test(key))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeForTest(sanitized[key])
    }
  }

  return sanitized
}

/**
 * Log incoming request for fixture extraction from CloudWatch
 * Marks production requests for automated fixture generation
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
  // Silence fixture logging during tests if LOG_LEVEL is SILENT
  if (getOptionalEnv('LOG_LEVEL', 'INFO').toUpperCase() === 'SILENT') {
    return
  }
  const detectedType = fixtureType || getOptionalEnv('AWS_LAMBDA_FUNCTION_NAME', 'UnknownLambda')
  console.log(JSON.stringify({__FIXTURE_MARKER__: 'INCOMING', fixtureType: detectedType, timestamp: Date.now(), data: sanitizeForTest(event)}))
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
  console.log(JSON.stringify({__FIXTURE_MARKER__: 'OUTGOING', fixtureType: detectedType, timestamp: Date.now(), data: sanitizeForTest(response)}))
}
