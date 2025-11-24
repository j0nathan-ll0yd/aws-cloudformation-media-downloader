/**
 * AWS Step Functions Vendor Wrapper
 *
 * Encapsulates AWS SDK Step Functions operations following the AWS SDK Encapsulation Policy.
 * All Step Functions interactions must go through this module.
 *
 * @module lib/vendor/AWS/StepFunctions
 */

import {
  StartExecutionCommand,
  StartExecutionInput,
  StartExecutionOutput,
  DescribeExecutionCommand,
  DescribeExecutionInput,
  DescribeExecutionOutput,
  StopExecutionCommand,
  StopExecutionInput,
  StopExecutionOutput,
  ListExecutionsCommand,
  ListExecutionsInput,
  ListExecutionsOutput
} from '@aws-sdk/client-sfn'
import {createStepFunctionsClient} from './clients'

const stepFunctionsClient = createStepFunctionsClient()

// Re-export types for application code to use
export type {
  StartExecutionInput,
  StartExecutionOutput,
  DescribeExecutionInput,
  DescribeExecutionOutput,
  StopExecutionInput,
  StopExecutionOutput,
  ListExecutionsInput,
  ListExecutionsOutput
}

/**
 * Start a Step Functions state machine execution
 *
 * @param params - StartExecution parameters
 * @returns Promise resolving to execution details
 *
 * @example
 * ```typescript
 * import {startExecution} from '../../../lib/vendor/AWS/StepFunctions'
 *
 * const result = await startExecution({
 *   stateMachineArn: 'arn:aws:states:us-west-2:123456789:stateMachine:FileDownloadWorkflow',
 *   input: JSON.stringify({fileId: 'abc123'})
 * })
 * console.log('Execution ARN:', result.executionArn)
 * ```
 */
/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function startExecution(params: StartExecutionInput): Promise<StartExecutionOutput> {
  const command = new StartExecutionCommand(params)
  return stepFunctionsClient.send(command)
}
/* c8 ignore stop */

/**
 * Describe a Step Functions execution
 *
 * @param params - DescribeExecution parameters
 * @returns Promise resolving to execution details
 *
 * @example
 * ```typescript
 * import {describeExecution} from '../../../lib/vendor/AWS/StepFunctions'
 *
 * const details = await describeExecution({
 *   executionArn: 'arn:aws:states:...'
 * })
 * console.log('Status:', details.status)
 * ```
 */
/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function describeExecution(params: DescribeExecutionInput): Promise<DescribeExecutionOutput> {
  const command = new DescribeExecutionCommand(params)
  return stepFunctionsClient.send(command)
}
/* c8 ignore stop */

/**
 * Stop a Step Functions execution
 *
 * @param params - StopExecution parameters
 * @returns Promise resolving to stop confirmation
 *
 * @example
 * ```typescript
 * import {stopExecution} from '../../../lib/vendor/AWS/StepFunctions'
 *
 * await stopExecution({
 *   executionArn: 'arn:aws:states:...',
 *   error: 'UserCancelled',
 *   cause: 'User requested cancellation'
 * })
 * ```
 */
/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function stopExecution(params: StopExecutionInput): Promise<StopExecutionOutput> {
  const command = new StopExecutionCommand(params)
  return stepFunctionsClient.send(command)
}
/* c8 ignore stop */

/**
 * List executions for a state machine
 *
 * @param params - ListExecutions parameters
 * @returns Promise resolving to list of executions
 *
 * @example
 * ```typescript
 * import {listExecutions} from '../../../lib/vendor/AWS/StepFunctions'
 *
 * const result = await listExecutions({
 *   stateMachineArn: 'arn:aws:states:...',
 *   maxResults: 10,
 *   statusFilter: 'FAILED'
 * })
 * console.log('Failed executions:', result.executions)
 * ```
 */
/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function listExecutions(params: ListExecutionsInput): Promise<ListExecutionsOutput> {
  const command = new ListExecutionsCommand(params)
  return stepFunctionsClient.send(command)
}
/* c8 ignore stop */
