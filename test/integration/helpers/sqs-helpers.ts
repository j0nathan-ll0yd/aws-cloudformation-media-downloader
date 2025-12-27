/**
 * SQS Test Helpers
 *
 * Utilities for creating SQS queues and managing messages in LocalStack.
 * Used for integration testing event-driven workflows.
 */

import {
  CreateQueueCommand,
  DeleteMessageCommand,
  DeleteQueueCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  PurgeQueueCommand,
  QueueAttributeName,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient
} from '@aws-sdk/client-sqs'
import type {Message, MessageAttributeValue} from '@aws-sdk/client-sqs'

const AWS_REGION = process.env.AWS_REGION || 'us-west-2'
const AWS_ACCOUNT_ID = '000000000000' // LocalStack default account ID

const sqsClient = new SQSClient({region: AWS_REGION, endpoint: 'http://localhost:4566', credentials: {accessKeyId: 'test', secretAccessKey: 'test'}})

/**
 * Creates a test SQS queue in LocalStack
 */
export async function createTestQueue(
  queueName: string,
  options?: {visibilityTimeout?: number; delaySeconds?: number; messageRetentionPeriod?: number}
): Promise<string> {
  try {
    const attributes: Record<string, string> = {}

    if (options?.visibilityTimeout !== undefined) {
      attributes['VisibilityTimeout'] = options.visibilityTimeout.toString()
    }
    if (options?.delaySeconds !== undefined) {
      attributes['DelaySeconds'] = options.delaySeconds.toString()
    }
    if (options?.messageRetentionPeriod !== undefined) {
      attributes['MessageRetentionPeriod'] = options.messageRetentionPeriod.toString()
    }

    const result = await sqsClient.send(
      new CreateQueueCommand({QueueName: queueName, Attributes: Object.keys(attributes).length > 0 ? attributes : undefined})
    )
    return result.QueueUrl!
  } catch (error) {
    if (error instanceof Error && error.name === 'QueueAlreadyExists') {
      const result = await sqsClient.send(new GetQueueUrlCommand({QueueName: queueName}))
      return result.QueueUrl!
    }
    throw error
  }
}

/**
 * Deletes a test SQS queue from LocalStack
 */
export async function deleteTestQueue(queueUrl: string): Promise<void> {
  try {
    await sqsClient.send(new DeleteQueueCommand({QueueUrl: queueUrl}))
  } catch {
    // Queue might not exist
  }
}

/**
 * Gets the ARN of a queue from its URL
 */
export function getQueueArnFromUrl(queueUrl: string): string {
  const parts = queueUrl.split('/')
  const queueName = parts[parts.length - 1]
  return `arn:aws:sqs:${AWS_REGION}:${AWS_ACCOUNT_ID}:${queueName}`
}

/**
 * Sends a test message to an SQS queue
 */
export async function sendTestMessage(
  queueUrl: string,
  body: string,
  attributes?: Record<string, MessageAttributeValue>,
  delaySeconds?: number
): Promise<string> {
  const result = await sqsClient.send(
    new SendMessageCommand({QueueUrl: queueUrl, MessageBody: body, MessageAttributes: attributes, DelaySeconds: delaySeconds})
  )
  return result.MessageId!
}

/**
 * Sends a JSON message to an SQS queue
 */
export async function sendJsonMessage(
  queueUrl: string,
  payload: Record<string, unknown>,
  attributes?: Record<string, MessageAttributeValue>
): Promise<string> {
  return sendTestMessage(queueUrl, JSON.stringify(payload), attributes)
}

/**
 * Receives messages from a queue with optional long polling
 */
export async function receiveTestMessages(
  queueUrl: string,
  options?: {maxMessages?: number; waitTimeSeconds?: number; visibilityTimeout?: number}
): Promise<Message[]> {
  const result = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: options?.maxMessages ?? 10,
      WaitTimeSeconds: options?.waitTimeSeconds ?? 0,
      VisibilityTimeout: options?.visibilityTimeout,
      MessageAttributeNames: ['All']
    })
  )
  return result.Messages || []
}

/**
 * Receives a single message from a queue
 */
export async function receiveOneMessage(queueUrl: string, waitTimeSeconds: number = 5): Promise<Message | null> {
  const messages = await receiveTestMessages(queueUrl, {maxMessages: 1, waitTimeSeconds})
  return messages[0] || null
}

/**
 * Deletes a message from a queue after processing
 */
export async function deleteTestMessage(queueUrl: string, message: Message): Promise<void> {
  if (!message.ReceiptHandle) {
    throw new Error('Message must have a ReceiptHandle to delete')
  }
  await sqsClient.send(new DeleteMessageCommand({QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle}))
}

/**
 * Drains all messages from a queue (for cleanup)
 */
export async function drainQueue(queueUrl: string): Promise<number> {
  let totalDrained = 0
  let messages: Message[]

  do {
    messages = await receiveTestMessages(queueUrl, {maxMessages: 10, waitTimeSeconds: 0})

    for (const message of messages) {
      await deleteTestMessage(queueUrl, message)
      totalDrained++
    }
  } while (messages.length > 0)

  return totalDrained
}

/**
 * Purges all messages from a queue
 */
export async function purgeTestQueue(queueUrl: string): Promise<void> {
  try {
    await sqsClient.send(new PurgeQueueCommand({QueueUrl: queueUrl}))
  } catch {
    // Purge might fail if called too frequently
  }
}

/**
 * Gets the approximate number of messages in a queue
 */
export async function getMessageCount(queueUrl: string): Promise<number> {
  const result = await sqsClient.send(new GetQueueAttributesCommand({QueueUrl: queueUrl, AttributeNames: [QueueAttributeName.ApproximateNumberOfMessages]}))
  return parseInt(result.Attributes?.ApproximateNumberOfMessages || '0', 10)
}

/**
 * Waits for a queue to have at least one message
 */
export async function waitForMessage(queueUrl: string, timeoutMs: number = 10000): Promise<boolean> {
  const startTime = Date.now()
  const pollInterval = 500

  while (Date.now() - startTime < timeoutMs) {
    const count = await getMessageCount(queueUrl)
    if (count > 0) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  return false
}

/**
 * Creates a string message attribute for SQS
 */
export function stringAttribute(value: string): MessageAttributeValue {
  return {DataType: 'String', StringValue: value}
}

/**
 * Creates a number message attribute for SQS
 */
export function numberAttribute(value: number): MessageAttributeValue {
  return {DataType: 'Number', StringValue: value.toString()}
}

export type { Message, MessageAttributeValue }
