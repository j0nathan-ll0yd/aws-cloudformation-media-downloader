/**
 * Logging utilities powered by AWS Lambda Powertools
 * Provides structured JSON logging with automatic context enrichment
 *
 * Backwards-compatible with existing logInfo/logDebug/logError calls
 */
import {logger} from '#lib/vendor/Powertools'

/**
 * Log an informational message with optional structured data
 * @param message - The log message
 * @param data - Optional structured data or string to include
 */
export function logInfo(message: string, data?: string | object): void {
  if (data === undefined) {
    logger.info(message)
  } else if (typeof data === 'string') {
    logger.info(message, {data})
  } else {
    logger.info(message, {data})
  }
}

/**
 * Log a debug message with optional structured data
 * @param message - The log message
 * @param data - Optional structured data or string to include
 */
export function logDebug(message: string, data?: string | object): void {
  if (data === undefined) {
    logger.debug(message)
  } else if (typeof data === 'string') {
    logger.debug(message, {data})
  } else {
    logger.debug(message, {data})
  }
}

/**
 * Log an error message with optional structured data or Error object
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
    logger.error(message, {data})
  }
}

// Re-export logger for direct access when needed
export { logger }
