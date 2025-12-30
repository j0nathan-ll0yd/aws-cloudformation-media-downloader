/**
 * E2E test setup
 * Configures environment for E2E testing against LocalStack
 */

import {afterAll, beforeAll} from 'vitest'

beforeAll(async () => {
  process.env.USE_LOCALSTACK = 'true'
  process.env.AWS_REGION = 'us-east-1'
  process.env.AWS_ACCESS_KEY_ID = 'test'
  process.env.AWS_SECRET_ACCESS_KEY = 'test'
  process.env.LOCALSTACK_HOSTNAME = 'localhost'
  process.env.LOCALSTACK_PORT = '4566'
})

afterAll(async () => {
  // Cleanup if needed
})
