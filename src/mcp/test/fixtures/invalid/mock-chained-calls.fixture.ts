/**
 * @fixture invalid
 * @rule mock-formatting
 * @severity MEDIUM
 * @description Chained mock return value calls (forbidden)
 * @expectedViolations 1
 * @simulatedPath src/lambdas/Test/test/index.test.ts
 */
mockFn.mockResolvedValueOnce(a).mockResolvedValueOnce(b)
