import {SFNClient, StartExecutionCommand, StartExecutionInput, StartExecutionOutput} from '@aws-sdk/client-sfn'
const stepfunctions = new SFNClient()

export function startExecution(params: StartExecutionInput): Promise<StartExecutionOutput> {
  const command = new StartExecutionCommand(params)
  return stepfunctions.send(command)
}
