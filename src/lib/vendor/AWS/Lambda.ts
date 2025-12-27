import {InvokeCommand} from '@aws-sdk/client-lambda'
import type {InvokeCommandInput, InvokeCommandOutput} from '@aws-sdk/client-lambda'
import {createLambdaClient} from './clients'

const lambda = createLambdaClient()

/**
 * Invokes a Lambda function
 * @param params - The invocation parameters
 * @returns The invocation response
 */
/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function invokeLambda(params: InvokeCommandInput): Promise<InvokeCommandOutput> {
  const command = new InvokeCommand(params)
  return lambda.send(command)
}
/* c8 ignore stop */

/**
 * Invokes a Lambda function asynchronously
 * @param functionName - The name of the Lambda function
 * @param payload - The payload to send to the function
 * @returns The invocation response
 */
/* c8 ignore start - Thin wrapper with minimal logic, tested via integration tests */
export async function invokeAsync(functionName: string, payload: Record<string, unknown>): Promise<InvokeCommandOutput> {
  const params: InvokeCommandInput = {FunctionName: functionName, InvocationType: 'Event', Payload: JSON.stringify(payload)}
  return invokeLambda(params)
}
/* c8 ignore stop */
