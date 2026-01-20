/**
 * Lambda Invocation Test Helpers
 *
 * Utilities for testing Lambda invocation patterns via LocalStack.
 * Note: Lambda deployment to LocalStack requires zip packaging which
 * is complex. These helpers provide simplified testing patterns.
 */

import {CreateFunctionCommand, DeleteFunctionCommand, InvokeCommand, ListFunctionsCommand} from '@aws-sdk/client-lambda'
import {createLambdaClient} from '#lib/vendor/AWS/clients'

const lambdaClient = createLambdaClient()

/**
 * Check if LocalStack Lambda service is available
 */
export async function isLambdaAvailable(): Promise<boolean> {
  try {
    await lambdaClient.send(new ListFunctionsCommand({}))
    return true
  } catch {
    return false
  }
}

/**
 * List all Lambda functions in LocalStack
 * @returns Array of function names
 */
export async function listFunctions(): Promise<string[]> {
  const result = await lambdaClient.send(new ListFunctionsCommand({}))
  return (result.Functions || []).map((f) => f.FunctionName || '')
}

/**
 * Invoke a Lambda function
 * @param functionName - Name of the function to invoke
 * @param payload - Payload to send to the function
 * @returns Invocation result
 */
export async function invokeFunction(functionName: string, payload: unknown): Promise<{statusCode: number | undefined; payload: unknown}> {
  const result = await lambdaClient.send(new InvokeCommand({FunctionName: functionName, Payload: Buffer.from(JSON.stringify(payload))}))

  let responsePayload: unknown
  if (result.Payload) {
    const payloadStr = Buffer.from(result.Payload).toString('utf-8')
    try {
      responsePayload = JSON.parse(payloadStr)
    } catch {
      responsePayload = payloadStr
    }
  }

  return {statusCode: result.StatusCode, payload: responsePayload}
}

/**
 * Create a minimal test Lambda function in LocalStack
 * Note: This creates a very simple function that echoes input
 *
 * @param functionName - Name for the function
 * @returns True if created successfully
 */
export async function createTestFunction(functionName: string): Promise<boolean> {
  // Minimal Lambda code that echoes input
  const code = `
    exports.handler = async (event) => {
      return {
        statusCode: 200,
        body: JSON.stringify({echo: event, timestamp: Date.now()})
      };
    };
  `

  // Create a minimal zip file in memory
  // LocalStack can accept inline code for simple functions
  const {createZipBuffer} = await import('./zip-utils')
  const zipBuffer = await createZipBuffer({'index.js': code})

  try {
    await lambdaClient.send(
      new CreateFunctionCommand({
        FunctionName: functionName,
        Runtime: 'nodejs20.x',
        Role: 'arn:aws:iam::000000000000:role/lambda-role',
        Handler: 'index.handler',
        Code: {ZipFile: zipBuffer}
      })
    )
    return true
  } catch (error) {
    console.log(`Failed to create function ${functionName}:`, error)
    return false
  }
}

/**
 * Delete a Lambda function from LocalStack
 * @param functionName - Name of the function to delete
 */
export async function deleteTestFunction(functionName: string): Promise<void> {
  try {
    await lambdaClient.send(new DeleteFunctionCommand({FunctionName: functionName}))
  } catch {
    // Ignore errors
  }
}

/**
 * Skip test helper for when LocalStack Lambda is unavailable
 * @param testFn - Test function to wrap
 * @returns Wrapped test function
 */
export function skipIfLambdaUnavailable(testFn: () => Promise<void>): () => Promise<void> {
  return async () => {
    const available = await isLambdaAvailable()
    if (!available) {
      console.log('Skipping test: LocalStack Lambda not available')
      return
    }
    await testFn()
  }
}
