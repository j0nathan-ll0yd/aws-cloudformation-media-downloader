import {LambdaClient, InvokeCommand, InvokeCommandInput} from '@aws-sdk/client-lambda'
const client = new LambdaClient({})
export function invoke(params: InvokeCommandInput) {
  const command = new InvokeCommand(params)
  return client.send(command)
}
