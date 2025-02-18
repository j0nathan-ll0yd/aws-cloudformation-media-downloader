import {LambdaClient, InvokeCommand, InvokeCommandInput} from '@aws-sdk/client-lambda'
const client = new LambdaClient({
  maxAttempts: 0 // Set to 1 for no retries, or 0 to disable retries
})
export function invoke(params: InvokeCommandInput) {
  const command = new InvokeCommand(params)
  return client.send(command)
}
