/**
 * Test Resource Naming Helper
 *
 * Generates worker-isolated resource names for AWS resources to prevent
 * collisions during parallel test execution.
 *
 * Naming format: `base-runId-wWorkerId-timestamp`
 *
 * Examples:
 *   - Local: test-queue-local-w1-1704067200000
 *   - CI: test-queue-12345-w3-1704067200000
 */

/**
 * Generate a worker-isolated resource name for AWS resources.
 * Prevents collisions during parallel test execution.
 *
 * @param base - Base name for the resource (e.g., 'test-queue', 'test-topic')
 * @returns Worker-isolated resource name
 */
export function generateTestResourceName(base: string): string {
  const runId = process.env.GITHUB_RUN_ID || 'local'
  const workerId = process.env.VITEST_POOL_ID || '0'
  const timestamp = Date.now()
  return `${base}-${runId}-w${workerId}-${timestamp}`
}

/**
 * Generate a short worker-isolated resource name.
 * Use when AWS resource name length limits are a concern.
 *
 * @param base - Base name for the resource
 * @returns Shortened worker-isolated resource name
 */
export function generateShortResourceName(base: string): string {
  const runId = process.env.GITHUB_RUN_ID?.slice(-6) || 'local'
  const workerId = process.env.VITEST_POOL_ID || '0'
  return `${base}-${runId}-w${workerId}`
}
