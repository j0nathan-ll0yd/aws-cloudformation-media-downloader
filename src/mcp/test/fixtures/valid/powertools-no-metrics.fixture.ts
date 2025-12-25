/**
 * @fixture valid
 * @rule powertools-metrics
 * @description Handler without any metrics usage
 * @simulatedPath src/lambdas/Test/src/index.ts
 */
export const handler = withPowertools(async () => {
  return {statusCode: 200}
})
