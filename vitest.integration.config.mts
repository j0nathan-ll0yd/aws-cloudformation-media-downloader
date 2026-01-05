import {resolve} from 'path'
import {cpus} from 'os'
import {defineConfig} from 'vitest/config'

// Optimize worker count for integration tests
// CI: 4 workers (balance between parallelism and PostgreSQL connections)
// Local: Use up to 6 workers (capped to avoid database connection exhaustion)
// Integration tests are I/O-bound, so more workers than cores can help
const isCI = process.env.CI === 'true'
const maxWorkers = isCI ? 4 : Math.min(cpus().length, 6)

// Standalone config for integration tests (does not merge with base to avoid exclude conflicts)
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/integration/**/*.integration.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'build/**'],
    clearMocks: true,
    testTimeout: 30000,
    hookTimeout: 60000, // Allow 60s for beforeAll/afterAll hooks (schema creation may retry up to 30s)
    pool: 'threads',
    maxWorkers,
    globalSetup: './test/integration/globalSetup.ts',
    setupFiles: ['./test/integration/setup.ts'],
    // Retry flaky tests in CI (up to 2 retries = 3 total attempts)
    // This catches transient failures from timing, network, or service startup
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
