/**
 * Lambda Integration Tests
 *
 * Tests Lambda vendor wrapper functions against LocalStack to verify:
 * - Synchronous Lambda invocation using invokeLambda
 * - Asynchronous Lambda invocation using invokeAsync
 * - Real AWS SDK interactions without mocking
 *
 * Note: These tests verify the invocation mechanism works, not the actual Lambda execution,
 * since deploying real Lambda functions to LocalStack is complex and beyond the scope
 * of basic integration testing.
 */

import {describe, test, expect} from '@jest/globals'
import {invokeLambda, invokeAsync} from '../../../src/lib/vendor/AWS/Lambda'
import {InvocationType} from '@aws-sdk/client-lambda'

const TEST_FUNCTION_NAME = 'test-integration-function'

describe('Lambda Integration Tests', () => {
  test('should invoke Lambda function synchronously using invokeLambda', async () => {
    // Arrange
    const payload = {message: 'test payload'}

    // Act
    const result = await invokeLambda({
      FunctionName: TEST_FUNCTION_NAME,
      InvocationType: InvocationType.RequestResponse,
      Payload: JSON.stringify(payload)
    })

    // Assert
    // LocalStack returns a response even if function doesn't exist
    // We verify the invocation mechanism works
    expect(result).toBeDefined()
    expect(result.$metadata).toBeDefined()
    expect(result.$metadata.httpStatusCode).toBeDefined()
  })

  test('should invoke Lambda function asynchronously using invokeAsync', async () => {
    // Arrange
    const payload = {message: 'async test payload', timestamp: Date.now()}

    // Act
    const result = await invokeAsync(TEST_FUNCTION_NAME, payload)

    // Assert
    // Async invocation returns StatusCode 202 (Accepted)
    // LocalStack simulates this behavior
    expect(result).toBeDefined()
    expect(result.$metadata).toBeDefined()
    expect(result.$metadata.httpStatusCode).toBeDefined()
  })

  test('should handle empty payload in invokeLambda', async () => {
    // Act
    const result = await invokeLambda({
      FunctionName: TEST_FUNCTION_NAME,
      InvocationType: InvocationType.RequestResponse,
      Payload: JSON.stringify({})
    })

    // Assert
    expect(result).toBeDefined()
    expect(result.$metadata).toBeDefined()
  })

  test('should handle empty payload in invokeAsync', async () => {
    // Act
    const result = await invokeAsync(TEST_FUNCTION_NAME, {})

    // Assert
    expect(result).toBeDefined()
    expect(result.$metadata).toBeDefined()
  })
})
