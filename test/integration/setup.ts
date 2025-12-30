/**
 * Integration Test Setup
 *
 * Configures the test environment for LocalStack integration tests.
 * This file runs before all integration tests via setupFiles in vitest.integration.config.mts
 */

import {beforeAll} from 'vitest'
import {getTestDbAsync} from './helpers/postgres-helpers'

/**
 * Ensure USE_LOCALSTACK is set
 * This triggers all vendor wrappers to use LocalStack clients instead of production AWS
 */
process.env.USE_LOCALSTACK = 'true'

/**
 * Set AWS region for LocalStack
 * Match production region (us-west-2) for consistency
 */
process.env.AWS_REGION = 'us-west-2'

/**
 * Wait for LocalStack to be ready
 * Checks LocalStack health endpoint before running tests
 */
async function waitForLocalStack(): Promise<void> {
  const maxRetries = 30
  const retryDelay = 1000
  const localstackUrl = 'http://localhost:4566/_localstack/health'

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(localstackUrl)
      if (response.ok) {
        const health = await response.json()
        if (process.env.LOG_LEVEL !== 'SILENT') {
          console.log('LocalStack is ready:', JSON.stringify(health, null, 2))
        }
        return
      }
    } catch {
      // LocalStack not ready yet, continue retrying
    }

    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
    }
  }

  throw new Error(`LocalStack is not responding after ${maxRetries} attempts. ` + 'Ensure LocalStack is running with: pnpm run localstack:start')
}

/**
 * Run health check before tests and initialize database connection
 * - LocalStack health check (skipped in CI)
 * - Initialize database connection with correct search_path for worker isolation
 */
beforeAll(async () => {
  if (!process.env.CI) {
    await waitForLocalStack()
  }

  // Initialize database connection with worker-specific search_path
  // This ensures all postgres-helpers operations use the correct schema
  await getTestDbAsync()
})
