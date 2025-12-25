/**
 * @fixture valid
 * @rule powertools-metrics
 * @description singleMetric used correctly with addDimension
 * @simulatedPath src/lambdas/Test/src/index.ts
 */
export const handler = withPowertools(async () => {
  const metric = metrics.singleMetric()
  metric.addDimension('Type', 'test')
  metric.addMetric('Count', MetricUnit.Count, 1)
}, {enableCustomMetrics: true})
