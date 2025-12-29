/**
 * Drizzle ORM Query Instrumentation
 *
 * Provides metrics for database query performance monitoring.
 * Uses AWS Powertools Metrics for CloudWatch embedded metrics format (EMF).
 *
 * @see src/lib/vendor/Powertools for metrics configuration
 */

import {metrics, MetricUnit} from '../Powertools'
import {logDebug} from '#lib/system/logging'

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
 * Wraps a query function with automatic timing and metrics.
 *
 * Captures execution time, success/failure, and optional row count.
 * Metrics are recorded to CloudWatch using embedded metrics format.
 *
 * @param queryName - Name for the query in metrics (e.g., 'Users.get')
 * @param queryFn - Async function that executes the query
 * @returns The query result
 * @throws Re-throws any error from the query after recording failure metric
 *
 * @example
 * ```typescript
 * const user = await withQueryMetrics('Users.get', async () => {
 *   return db.select().from(users).where(eq(users.id, userId))
 * })
 * ```
 */
export async function withQueryMetrics<T>(queryName: string, queryFn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  try {
    const result = await queryFn()
    const duration = performance.now() - start

    recordQueryMetric({queryName, duration, success: true, rowCount: Array.isArray(result) ? result.length : undefined})

    return result
  } catch (error) {
    const duration = performance.now() - start
    recordQueryMetric({queryName, duration, success: false})
    throw error
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
