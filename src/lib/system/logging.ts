/**
 * Logging utilities powered by AWS Lambda Powertools
 * Provides structured JSON logging with automatic context enrichment
 *
 * Backwards-compatible with existing logInfo/logDebug/logError calls
 */
import {logger} from '#lib/vendor/Powertools'
import {sanitizeData} from '#util/security'

/**
 * Log an informational message with optional structured data
 * Automatically sanitizes PII from objects to prevent sensitive data leakage
 * @param message - The log message
 * @param data - Optional structured data or string to include
 */
export function logInfo(message: string, data?: string | object): void {
  if (data === undefined) {
    logger.info(message)
  } else if (typeof data === 'string') {
    logger.info(message, {data})
  } else {
    logger.info(message, {data: sanitizeData(data)})
  }
}

/**
 * Log a debug message with optional structured data
 * Automatically sanitizes PII from objects to prevent sensitive data leakage
 * @param message - The log message
 * @param data - Optional structured data or string to include
 */
export function logDebug(message: string, data?: string | object): void {
  if (data === undefined) {
    logger.debug(message)
  } else if (typeof data === 'string') {
    logger.debug(message, {data})
  } else {
    logger.debug(message, {data: sanitizeData(data)})
  }
}

/**
 * Log an error message with optional structured data or Error object
 * Automatically sanitizes PII from objects to prevent sensitive data leakage
 * @param message - The log message
 * @param data - Optional structured data, string, or Error object
 */
export function logError(message: string, data?: string | object | Error | unknown): void {
  if (data === undefined) {
    logger.error(message)
  } else if (data instanceof Error) {
    logger.error(message, data)
  } else if (typeof data === 'string') {
    logger.error(message, {data})
  } else {
    logger.error(message, {data: sanitizeData(data)})
  }
}

/**
 * Extract essential request info for logging
 * Reduces log size from ~2.5KB to ~150 bytes per request
 * Full event details are available via X-Ray traces
 * @param event - API Gateway event or similar request object
 * @returns Compact summary with path, method, requestId, sourceIp
 */
export function getRequestSummary(event: unknown): object {
  const e = event as Record<string, unknown>
  const requestContext = e.requestContext as Record<string, unknown> | undefined
  const identity = requestContext?.identity as Record<string, unknown> | undefined

  return {path: e.path || e.resource, method: e.httpMethod, requestId: requestContext?.requestId, sourceIp: identity?.sourceIp}
}

// Re-export logger for direct access when needed
export { logger }
