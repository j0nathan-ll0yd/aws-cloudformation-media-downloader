/**
 * Integration Test Setup
 *
 * Configures the test environment for LocalStack integration tests.
 * This file runs before all integration tests via setupFilesAfterEnv in jest.integration.config.mjs
 */

import {jest, beforeAll} from '@jest/globals'

/**
 * Ensure USE_LOCALSTACK is set
 * This triggers all vendor wrappers to use LocalStack clients instead of production AWS
 */
process.env.USE_LOCALSTACK = 'true'

/**
 * Set AWS region for LocalStack
 * LocalStack uses us-east-1 by default
 */
process.env.AWS_REGION = 'us-east-1'

/**
 * Configure test timeout
 * Integration tests may take longer due to LocalStack initialization
 */
jest.setTimeout(30000)

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
        console.log('LocalStack is ready:', JSON.stringify(health, null, 2))
        return
      }
    } catch (error) {
      // LocalStack not ready yet, continue retrying
    }

    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
    }
  }

  throw new Error(`LocalStack is not responding after ${maxRetries} attempts. ` + 'Ensure LocalStack is running with: npm run localstack:start')
}

/**
 * Run health check before tests
 * Only check if not in CI environment (CI will handle LocalStack lifecycle)
 */
beforeAll(async () => {
  if (!process.env.CI) {
    await waitForLocalStack()
  }
})
