import {LambdaClient, InvokeCommand, InvokeCommandInput, InvokeCommandOutput} from '@aws-sdk/client-lambda'
import AWSXRay from 'aws-xray-sdk-core'

const enableXRay = process.env.ENABLE_XRAY !== 'false'
const baseClient = new LambdaClient({region: process.env.AWS_REGION || 'us-west-2'})
const lambda = enableXRay ? AWSXRay.captureAWSv3Client(baseClient) : baseClient

/**
 * Invokes a Lambda function
 * @param params - The invocation parameters
 * @returns The invocation response
 */
export function invokeLambda(params: InvokeCommandInput): Promise<InvokeCommandOutput> {
  const command = new InvokeCommand(params)
  return lambda.send(command)
}

/**
 * Invokes a Lambda function asynchronously
 * @param functionName - The name of the Lambda function
 * @param payload - The payload to send to the function
 * @returns The invocation response
 */
export async function invokeAsync(functionName: string, payload: Record<string, unknown>): Promise<InvokeCommandOutput> {
  const params: InvokeCommandInput = {
    FunctionName: functionName,
    InvocationType: 'Event',
    Payload: JSON.stringify(payload)
  }
  return invokeLambda(params)
}
