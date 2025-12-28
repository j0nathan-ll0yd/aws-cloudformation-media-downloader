import {defineConfig, mergeConfig} from 'vitest/config'
import baseConfig from './vitest.config.mts'

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['test/e2e/scenarios/**/*.test.ts'],
      exclude: [],
      testTimeout: 60000,
      setupFiles: ['./test/e2e/setup.ts'],
      poolOptions: {
        threads: {
          maxThreads: 2
        }
      },
      coverage: {
        reportsDirectory: './coverage/e2e'
      },
      env: {
        USE_LOCALSTACK: 'true'
      }
    }
  })
)
