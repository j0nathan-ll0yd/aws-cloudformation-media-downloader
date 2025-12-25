/**
 * @fixture invalid
 * @rule powertools-metrics
 * @description addMetric used without enableCustomMetrics
 * @simulatedPath src/lambdas/Test/src/index.ts
 * @expectedViolations 1
 */
export const handler = withPowertools(async () => {
  metrics.addMetric('Count', MetricUnit.Count, 1)
  return {statusCode: 200}
})
