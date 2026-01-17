import {resolve} from 'path'
import {cpus} from 'os'
import {defineConfig} from 'vitest/config'

// Optimize worker count for integration tests
// CI: 4 workers (balance between parallelism and PostgreSQL connections)
// Local: Use up to 6 workers (capped to avoid database connection exhaustion)
// Integration tests are I/O-bound, so more workers than cores can help
const isCI = process.env.CI === 'true'
const maxWorkers = isCI ? 4 : Math.min(cpus().length, 6)

// Standalone config for integration tests
// NOTE: Does not merge with base vitest.config.mts to avoid exclude conflicts
// Integration tests need different excludes and longer timeouts than unit tests
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/integration/**/*.integration.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'build/**'],
    clearMocks: true,
    // Test timeout: 30s - allows for I/O operations and database queries
    // Integration tests hit real Aurora DSQL which has variable latency
    testTimeout: 30000,
    // Hook timeout: 60s - allows for schema creation (up to 30s) plus retry buffer
    // Aurora DSQL schema operations can take longer during cold starts
    hookTimeout: 60000,
    pool: 'threads',
    maxWorkers,
    globalSetup: './test/integration/globalSetup.ts',
    setupFiles: ['./test/integration/setup.ts'],
    // Retry only in CI - respects local developer experience
    // Flaky tests get 2 retries (3 total attempts) to handle transient failures
    // from timing issues, network blips, or Aurora DSQL cold starts
    retry: isCI ? 2 : 0,
    // Generate JUnit reports for CI analysis and flaky test tracking
    reporters: isCI
      ? ['default', ['junit', {outputFile: 'test-results/integration-results.xml', suiteName: 'Integration Tests'}]]
      : ['default'],
    // Allow all console output through (don't filter any logs)
    onConsoleLog: () => false,
    coverage: {
      enabled: true,
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/test/**', 'src/mcp/**', '**/*.json'],
      provider: 'custom',
      customProviderModule: 'vitest-monocart-coverage',
      reportsDirectory: './coverage/integration'
    },
    alias: {
      '#entities': resolve(__dirname, 'src/entities'),
      '#lib': resolve(__dirname, 'src/lib'),
      '#util': resolve(__dirname, 'src/util'),
      '#types': resolve(__dirname, 'src/types'),
      '#test': resolve(__dirname, 'test')
    },
    silent: process.env.LOG_LEVEL === 'SILENT'
  }
})
