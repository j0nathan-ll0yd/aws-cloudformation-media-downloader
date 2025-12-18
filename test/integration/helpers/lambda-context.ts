/**
 * Lambda Context Mock Helper
 *
 * Creates mock AWS Lambda Context objects for integration tests
 */

import type {Context} from 'aws-lambda'

/**
 * Create a mock Lambda context for testing
 */
export function createMockContext(overrides?: Partial<Context>): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-west-2:123456789012:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: `test-request-${Date.now()}`,
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2024/01/01/[$LATEST]test-stream',
    identity: undefined,
    clientContext: undefined,
    getRemainingTimeInMillis: () => 30000, // 30 seconds remaining
    done: () => {},
    fail: () => {},
    succeed: () => {},
    ...overrides
  }
}
