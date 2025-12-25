/**
 * @fixture valid
 * @rule powertools-metrics
 * @description Handler with addMetric AND enableCustomMetrics
 * @simulatedPath src/lambdas/Test/src/index.ts
 */
export const handler = withPowertools(async () => {
  metrics.addMetric('Count', MetricUnit.Count, 1)
  return {statusCode: 200}
}, {enableCustomMetrics: true})
