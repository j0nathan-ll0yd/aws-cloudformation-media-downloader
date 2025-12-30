import {resolve} from 'path'
import {cpus} from 'os'
import {defineConfig} from 'vitest/config'

// Optimize worker count based on environment
// CI: 4 workers (typical runner has 2 cores, hyperthreading gives 4)
// Local: Use available cores (capped at 8 to avoid memory pressure)
const isCI = process.env.CI === 'true'
const maxWorkers = isCI ? 4 : Math.min(cpus().length, 8)

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['node_modules/**', 'dist/**', 'build/**', 'test/integration/**'],
    clearMocks: true,
    testTimeout: 10000,
    pool: 'threads',
    maxWorkers,
    minWorkers: 1,
    coverage: {
      enabled: true,
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/test/**', 'src/mcp/**', '**/*.json'],
      provider: 'custom',
      customProviderModule: 'vitest-monocart-coverage',
      reportsDirectory: './coverage/unit'
    },
    alias: {
      '#entities': resolve(__dirname, 'src/entities'),
      '#lib': resolve(__dirname, 'src/lib'),
      '#util': resolve(__dirname, 'src/util'),
      '#types': resolve(__dirname, 'src/types'),
      '#test': resolve(__dirname, 'test')
    },
    setupFiles: ['./test/setup.ts'],
    silent: process.env.LOG_LEVEL === 'SILENT'
  }
})
