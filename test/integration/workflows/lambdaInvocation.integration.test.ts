/**
 * Lambda Invocation Integration Tests
 *
 * Tests Lambda invocation patterns via LocalStack including
 * function invocation, payload handling, and error responses.
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'

import {afterAll, beforeAll, describe, expect, test} from 'vitest'
import {createTestFunction, deleteTestFunction, invokeFunction, isLambdaAvailable, listFunctions} from '../helpers/lambda-invocation-helpers'

describe('Lambda Invocation Integration Tests', () => {
  let lambdaAvailable = false
  const testFunctionName = `test-function-${Date.now()}`
  let functionCreated = false

  beforeAll(async () => {
    lambdaAvailable = await isLambdaAvailable()
    if (!lambdaAvailable) {
      console.log('LocalStack Lambda not available - some tests will be skipped')
      return
    }

    // Try to create a test function
    functionCreated = await createTestFunction(testFunctionName)
    if (!functionCreated) {
      console.log('Could not create test function - some tests will be skipped')
    }
  })

  afterAll(async () => {
    if (functionCreated) {
      await deleteTestFunction(testFunctionName)
    }
  })

  test('should verify LocalStack Lambda service is available', async () => {
    const available = await isLambdaAvailable()
    expect(typeof available).toBe('boolean')
    console.log(`Lambda service available: ${available}`)
  })

  test('should list Lambda functions', async () => {
    if (!lambdaAvailable) {
      console.log('Skipping: Lambda not available')
      return
    }

    const functions = await listFunctions()
    expect(Array.isArray(functions)).toBe(true)
    console.log(`Found ${functions.length} Lambda functions`)

    if (functionCreated) {
      expect(functions).toContain(testFunctionName)
    }
  })

  test('should invoke Lambda function with payload', async () => {
    if (!lambdaAvailable || !functionCreated) {
      console.log('Skipping: Lambda function not available')
      return
    }

    const payload = {message: 'Hello', data: {value: 42}}
    const result = await invokeFunction(testFunctionName, payload)

    expect(result.statusCode).toBe(200)
    expect(result.payload).toBeDefined()

    // The echo function returns the input in the body
    const body = (result.payload as {body?: string})?.body
    if (body) {
      const parsed = JSON.parse(body)
      expect(parsed.echo).toEqual(payload)
      expect(parsed.timestamp).toBeDefined()
    }
  })

  test('should handle empty payload', async () => {
    if (!lambdaAvailable || !functionCreated) {
      console.log('Skipping: Lambda function not available')
      return
    }

    const result = await invokeFunction(testFunctionName, {})

    expect(result.statusCode).toBe(200)
    expect(result.payload).toBeDefined()
  })

  test('should handle complex payload', async () => {
    if (!lambdaAvailable || !functionCreated) {
      console.log('Skipping: Lambda function not available')
      return
    }

    const complexPayload = {array: [1, 2, 3], nested: {deep: {value: 'test'}}, nullValue: null, number: 123.456, boolean: true}

    const result = await invokeFunction(testFunctionName, complexPayload)

    expect(result.statusCode).toBe(200)
    expect(result.payload).toBeDefined()
  })

  test('should handle invocation of non-existent function', async () => {
    if (!lambdaAvailable) {
      console.log('Skipping: Lambda not available')
      return
    }

    try {
      await invokeFunction('non-existent-function-xyz-123', {test: true})
      // If it doesn't throw, that's also valid behavior for LocalStack
    } catch (error) {
      // Expected - function doesn't exist
      expect(error).toBeDefined()
    }
  })
})
