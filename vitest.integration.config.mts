import {resolve} from 'path'
import {defineConfig} from 'vitest/config'

// Standalone config for integration tests (does not merge with base to avoid exclude conflicts)
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/integration/**/*.integration.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'build/**'],
    clearMocks: true,
    testTimeout: 30000,
    pool: 'threads',
    maxWorkers: 4,
    minWorkers: 1,
    globalSetup: './test/integration/globalSetup.ts',
    setupFiles: ['./test/integration/setup.ts'],
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
