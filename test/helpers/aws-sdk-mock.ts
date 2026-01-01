/**
 * AWS SDK Client Mock Utilities
 *
 * Provides type-safe mocking of AWS SDK v3 clients using aws-sdk-client-mock.
 * These utilities integrate with the vendor wrapper architecture by allowing
 * mock clients to be injected into the client factory.
 *
 * @see https://github.com/m-radzikowski/aws-sdk-client-mock
 * @see https://www.npmjs.com/package/aws-sdk-client-mock-vitest
 *
 * @example
 * ```typescript
 * import {createSQSMock, resetAllAwsMocks} from '#test/helpers/aws-sdk-mock'
 * import {SendMessageCommand} from '@aws-sdk/client-sqs'
 *
 * const sqsMock = createSQSMock()
 *
 * beforeEach(() => {
 *   sqsMock.reset()
 *   sqsMock.on(SendMessageCommand).resolves({MessageId: 'msg-123'})
 * })
 *
 * afterAll(() => {
 *   resetAllAwsMocks()
 * })
 *
 * test('should send message', async () => {
 *   await handler(event, context)
 *   expect(sqsMock).toHaveReceivedCommand(SendMessageCommand)
 * })
 * ```
 */

import {type AwsClientStub, mockClient} from 'aws-sdk-client-mock'
import {SQSClient} from '@aws-sdk/client-sqs'
import {SNSClient} from '@aws-sdk/client-sns'
import {EventBridgeClient} from '@aws-sdk/client-eventbridge'
import {setTestEventBridgeClient, setTestSNSClient, setTestSQSClient} from '#lib/vendor/AWS/clients'

// Base interface for mock instances with reset/restore methods
interface MockInstance {
  reset(): void
  restore(): void
}

// Store mock instances for cleanup
const mockInstances: MockInstance[] = []

/**
 * Creates a mock SQS client and injects it into the client factory.
 * @returns The mock client instance for configuring responses and assertions
 */
export function createSQSMock(): AwsClientStub<SQSClient> {
  const mock = mockClient(SQSClient)
  mockInstances.push(mock)
  setTestSQSClient(mock as unknown as SQSClient)
  return mock
}

/**
 * Creates a mock SNS client and injects it into the client factory.
 * @returns The mock client instance for configuring responses and assertions
 */
export function createSNSMock(): AwsClientStub<SNSClient> {
  const mock = mockClient(SNSClient)
  mockInstances.push(mock)
  setTestSNSClient(mock as unknown as SNSClient)
  return mock
}

/**
 * Creates a mock EventBridge client and injects it into the client factory.
 * @returns The mock client instance for configuring responses and assertions
 */
export function createEventBridgeMock(): AwsClientStub<EventBridgeClient> {
  const mock = mockClient(EventBridgeClient)
  mockInstances.push(mock)
  setTestEventBridgeClient(mock as unknown as EventBridgeClient)
  return mock
}

/**
 * Resets all AWS mock clients and clears the test client injections.
 * Call this in afterAll() to clean up between test files.
 */
export function resetAllAwsMocks(): void {
  for (const mock of mockInstances) {
    mock.reset()
    mock.restore()
  }
  mockInstances.length = 0

  // Clear all test client injections
  setTestSQSClient(null)
  setTestSNSClient(null)
  setTestEventBridgeClient(null)
}

// Re-export types for convenience
export type { AwsClientStub }
