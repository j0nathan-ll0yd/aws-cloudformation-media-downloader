/**
 * Lambda Integration Tests
 *
 * Tests Lambda vendor wrapper functions against LocalStack to verify:
 * - Error handling when invoking non-existent functions
 * - Vendor wrapper correctly propagates AWS SDK errors
 * - Real AWS SDK interactions without mocking
 *
 * Note: These tests verify error handling rather than successful execution,
 * since deploying actual Lambda functions to LocalStack requires additional setup.
 * The key validation is that our vendor wrappers correctly interact with the
 * Lambda service and handle errors appropriately.
 */

import {describe, test, expect} from '@jest/globals'
import {invokeLambda, invokeAsync} from '../../../src/lib/vendor/AWS/Lambda'
import {InvocationType} from '@aws-sdk/client-lambda'

const TEST_FUNCTION_NAME = 'test-integration-function'

describe('Lambda Integration Tests', () => {
  test('should throw ResourceNotFoundException when invoking non-existent function synchronously', async () => {
    // Arrange
    const payload = {message: 'test payload'}

    // Act & Assert
    await expect(
      invokeLambda({
        FunctionName: TEST_FUNCTION_NAME,
        InvocationType: InvocationType.RequestResponse,
        Payload: JSON.stringify(payload)
      })
    ).rejects.toThrow('ResourceNotFoundException')
  })

  test('should throw ResourceNotFoundException when invoking non-existent function asynchronously', async () => {
    // Arrange
    const payload = {message: 'async test payload', timestamp: Date.now()}

    // Act & Assert
    await expect(invokeAsync(TEST_FUNCTION_NAME, payload)).rejects.toThrow('ResourceNotFoundException')
  })

  test('should propagate errors correctly with empty payload in invokeLambda', async () => {
    // Act & Assert
    await expect(
      invokeLambda({
        FunctionName: TEST_FUNCTION_NAME,
        InvocationType: InvocationType.RequestResponse,
        Payload: JSON.stringify({})
      })
    ).rejects.toThrow('ResourceNotFoundException')
  })

  test('should propagate errors correctly with empty payload in invokeAsync', async () => {
    // Act & Assert
    await expect(invokeAsync(TEST_FUNCTION_NAME, {})).rejects.toThrow('ResourceNotFoundException')
  })
})
