import {defineConfig, mergeConfig} from 'vitest/config'
import baseConfig from './vitest.config.mts'

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['test/integration/**/*.integration.test.ts'],
      exclude: [],
      testTimeout: 30000,
      globalSetup: './test/integration/globalSetup.ts',
      setupFiles: ['./test/integration/setup.ts'],
      poolOptions: {
        threads: {
          maxThreads: 4
        }
      },
      coverage: {
        reportsDirectory: './coverage/integration'
      }
    }
  })
)
