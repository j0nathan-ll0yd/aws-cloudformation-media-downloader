import {InvokeCommand} from '@aws-sdk/client-lambda'
import type {InvokeCommandInput, InvokeCommandOutput} from '@aws-sdk/client-lambda'
import {createLambdaClient} from './clients'

const lambda = createLambdaClient()

/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
/** Invokes a Lambda function synchronously. */
export function invokeLambda(params: InvokeCommandInput): Promise<InvokeCommandOutput> {
  const command = new InvokeCommand(params)
  return lambda.send(command)
}
/* c8 ignore stop */

/* c8 ignore start - Thin wrapper with minimal logic, tested via integration tests */
/** Invokes a Lambda function asynchronously with fire-and-forget semantics. */
export async function invokeAsync(functionName: string, payload: Record<string, unknown>): Promise<InvokeCommandOutput> {
  const params: InvokeCommandInput = {FunctionName: functionName, InvocationType: 'Event', Payload: JSON.stringify(payload)}
  return invokeLambda(params)
}
/* c8 ignore stop */
