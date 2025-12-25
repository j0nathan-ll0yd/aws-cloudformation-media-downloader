/**
 * @fixture invalid
 * @rule powertools-metrics
 * @description addDimension used without singleMetric
 * @simulatedPath src/lambdas/Test/src/index.ts
 * @expectedViolations 1
 */
export const handler = withPowertools(async () => {
  metrics.addDimension('Type', 'test')
  metrics.addMetric('Count', MetricUnit.Count, 1)
}, {enableCustomMetrics: true})
