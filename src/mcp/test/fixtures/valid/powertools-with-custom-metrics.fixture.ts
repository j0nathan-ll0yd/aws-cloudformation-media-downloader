/**
 * @fixture valid
 * @rule powertools-metrics
 * @description Handler with addMetric (auto-flushed by withPowertools)
 * @simulatedPath src/lambdas/Test/src/index.ts
 */
export const handler = withPowertools(async () => {
  metrics.addMetric('Count', MetricUnit.Count, 1)
  return {statusCode: 200}
})
