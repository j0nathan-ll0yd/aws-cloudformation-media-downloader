/**
 * Drizzle ORM Query Instrumentation
 *
 * Provides metrics and tracing for database query performance monitoring.
 * Uses AWS Powertools Metrics for CloudWatch embedded metrics format (EMF)
 * and OpenTelemetry for X-Ray distributed tracing.
 *
 * @see src/lib/vendor/Powertools for metrics configuration
 * @see src/lib/vendor/OpenTelemetry for tracing configuration
 */

import {metrics, MetricUnit} from '../Powertools'
import {addAnnotation, addMetadata, endSpan, startSpan} from '../OpenTelemetry'
import {logDebug, logError} from '#lib/system/logging'
import {DatabaseError} from '#lib/system/errors'

/**
 * Metrics collected for each query execution.
 */
export interface QueryMetrics {
  /** Name of the query operation (e.g., 'Users.get', 'Files.query.byStatus') */
  queryName: string
  /** Duration in milliseconds */
  duration: number
  /** Whether the query succeeded */
  success: boolean
  /** Number of rows returned (if applicable) */
  rowCount?: number
}

/**
 * Records a single query metric to CloudWatch.
 *
 * Uses a single metric emission to avoid polluting logs with multiple EMF blobs.
 * Dimensions allow filtering by query name and success status.
 *
 * @param queryMetrics - Metrics from the query execution
 */
export function recordQueryMetric(queryMetrics: QueryMetrics): void {
  const metric = metrics.singleMetric()
  metric.addDimension('QueryName', queryMetrics.queryName)
  metric.addDimension('Success', String(queryMetrics.success))
  metric.addMetric('QueryDuration', MetricUnit.Milliseconds, queryMetrics.duration)

  if (queryMetrics.rowCount !== undefined) {
    const countMetric = metrics.singleMetric()
    countMetric.addDimension('QueryName', queryMetrics.queryName)
    countMetric.addMetric('RowCount', MetricUnit.Count, queryMetrics.rowCount)
  }

  logDebug('recordQueryMetric', {
    queryName: queryMetrics.queryName,
    duration: queryMetrics.duration,
    success: queryMetrics.success,
    rowCount: queryMetrics.rowCount
  })
}

/**
 * Wraps a query function with automatic timing, metrics, and X-Ray tracing.
 *
 * Captures execution time, success/failure, and optional row count.
 * Metrics are recorded to CloudWatch using embedded metrics format.
 * Spans are recorded to X-Ray via OpenTelemetry for distributed tracing.
 *
 * @param queryName - Name for the query in metrics (e.g., 'Users.get')
 * @param queryFn - Async function that executes the query
 * @returns The query result
 * @throws Re-throws any error from the query after recording failure metric
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/TypeScript/Drizzle-Patterns#query-instrumentation | Query Instrumentation}
 */
export async function withQueryMetrics<T>(queryName: string, queryFn: () => Promise<T>): Promise<T> {
  const span = startSpan(`db:${queryName}`)
  addAnnotation(span, 'query', queryName)
  const start = performance.now()

  try {
    const result = await queryFn()
    const duration = performance.now() - start
    const rowCount = Array.isArray(result) ? result.length : undefined

    recordQueryMetric({queryName, duration, success: true, rowCount})
    addMetadata(span, 'duration', duration)
    addMetadata(span, 'success', true)
    if (rowCount !== undefined) {
      addMetadata(span, 'rowCount', rowCount)
    }
    endSpan(span)

    return result
  } catch (error) {
    const duration = performance.now() - start
    recordQueryMetric({queryName, duration, success: false})
    addMetadata(span, 'duration', duration)
    addMetadata(span, 'success', false)
    endSpan(span, error as Error)

    // Log full error details for debugging (including SQL for ops troubleshooting)
    const originalError = error instanceof Error ? error : new Error(String(error))
    // Extract postgres-specific error properties (code, detail, hint, severity, etc.)
    const pgError = error as {
      code?: string
      detail?: string
      hint?: string
      severity?: string
      where?: string
      constraint?: string
      routine?: string
      cause?: unknown
    }
    // Also get all enumerable properties for debugging
    const errorProps = Object.fromEntries(Object.entries(error as object).filter(([, v]) => v !== undefined))
    logError('database query failed', {
      queryName,
      duration,
      errorName: originalError.name,
      errorMessage: originalError.message,
      // PostgreSQL error fields
      pgCode: pgError.code,
      pgDetail: pgError.detail,
      pgHint: pgError.hint,
      pgSeverity: pgError.severity,
      pgWhere: pgError.where,
      pgConstraint: pgError.constraint,
      pgRoutine: pgError.routine,
      pgCause: pgError.cause,
      // All error properties for debugging
      errorProps
    })

    // Wrap in DatabaseError to sanitize client response
    throw new DatabaseError(queryName, originalError)
  }
}

/**
 * Records a DSQL connection event metric.
 *
 * Used to track connection establishment and token refresh events.
 *
 * @param eventType - Type of connection event
 */
export function recordConnectionMetric(eventType: 'established' | 'token_refreshed' | 'closed'): void {
  const metric = metrics.singleMetric()
  metric.addDimension('EventType', eventType)
  metric.addMetric('DSQLConnectionEvent', MetricUnit.Count, 1)

  logDebug('recordConnectionMetric', {eventType})
}
