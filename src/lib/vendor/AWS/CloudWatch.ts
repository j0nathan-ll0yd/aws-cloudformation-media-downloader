/**
 * CloudWatch Logs Vendor Wrapper
 *
 * Encapsulates AWS CloudWatch Logs SDK operations for log management.
 * Used for creating log groups/streams and putting log events.
 *
 * @see src/lib/vendor/AWS/clients.ts for client factory
 */
import {
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  DeleteLogGroupCommand,
  DescribeLogStreamsCommand,
  GetLogEventsCommand,
  PutLogEventsCommand
} from '@aws-sdk/client-cloudwatch-logs'
import type {InputLogEvent, OutputLogEvent} from '@aws-sdk/client-cloudwatch-logs'
import {createCloudWatchLogsClient} from './clients'

const logs = createCloudWatchLogsClient()

// Re-export types for application code
export type { InputLogEvent, OutputLogEvent }

/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */

/**
 * Create a CloudWatch log group
 * @param logGroupName - Name of the log group
 */
export async function createLogGroup(logGroupName: string): Promise<void> {
  const command = new CreateLogGroupCommand({logGroupName})
  await logs.send(command)
}

/**
 * Delete a CloudWatch log group
 * @param logGroupName - Name of the log group
 */
export async function deleteLogGroup(logGroupName: string): Promise<void> {
  const command = new DeleteLogGroupCommand({logGroupName})
  await logs.send(command)
}

/**
 * Create a CloudWatch log stream within a log group
 * @param logGroupName - Name of the log group
 * @param logStreamName - Name of the log stream
 */
export async function createLogStream(logGroupName: string, logStreamName: string): Promise<void> {
  const command = new CreateLogStreamCommand({logGroupName, logStreamName})
  await logs.send(command)
}

/**
 * Put log events to a CloudWatch log stream
 * @param logGroupName - Name of the log group
 * @param logStreamName - Name of the log stream
 * @param events - Log events to put
 * @param sequenceToken - Optional sequence token for subsequent puts
 * @returns The next sequence token for subsequent puts
 */
export async function putLogEvents(
  logGroupName: string,
  logStreamName: string,
  events: InputLogEvent[],
  sequenceToken?: string
): Promise<string | undefined> {
  const command = new PutLogEventsCommand({logGroupName, logStreamName, logEvents: events, sequenceToken})
  const result = await logs.send(command)
  return result.nextSequenceToken
}

/**
 * Get log events from a CloudWatch log stream
 * @param logGroupName - Name of the log group
 * @param logStreamName - Name of the log stream
 * @param limit - Maximum number of events to return (default: 100)
 * @returns Array of log events
 */
export async function getLogEvents(logGroupName: string, logStreamName: string, limit = 100): Promise<OutputLogEvent[]> {
  const command = new GetLogEventsCommand({logGroupName, logStreamName, limit, startFromHead: true})
  const result = await logs.send(command)
  return result.events || []
}

/**
 * Get the sequence token for a log stream (needed for putLogEvents)
 * @param logGroupName - Name of the log group
 * @param logStreamName - Name of the log stream
 * @returns Sequence token or undefined if stream is new
 */
export async function getLogStreamSequenceToken(logGroupName: string, logStreamName: string): Promise<string | undefined> {
  const command = new DescribeLogStreamsCommand({logGroupName, logStreamNamePrefix: logStreamName, limit: 1})
  const result = await logs.send(command)
  const stream = result.logStreams?.find((s) => s.logStreamName === logStreamName)
  return stream?.uploadSequenceToken
}

/* c8 ignore stop */
