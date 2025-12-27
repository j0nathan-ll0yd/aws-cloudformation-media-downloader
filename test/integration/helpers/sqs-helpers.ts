/**
 * SQS Test Helpers
 *
 * Utilities for creating SQS queues and managing messages in LocalStack.
 * Used for integration testing event-driven workflows.
 */

import {
  createQueue,
  deleteMessage,
  deleteQueue,
  getQueueAttributes,
  getQueueUrl,
  purgeQueue,
  QueueAttributeName,
  receiveMessage,
  sendMessage
} from '../lib/vendor/AWS/SQS'
import type {Message, MessageAttributeValue} from '../lib/vendor/AWS/SQS'

const AWS_REGION = process.env.AWS_REGION || 'us-west-2'
const AWS_ACCOUNT_ID = '000000000000' // LocalStack default account ID

/**
 * Creates a test SQS queue in LocalStack
 *
 * @param queueName - Name of the queue
 * @param options - Optional queue configuration
 * @returns Queue URL
 */
export async function createTestQueue(
  queueName: string,
  options?: {
    visibilityTimeout?: number
    delaySeconds?: number
    messageRetentionPeriod?: number
  }
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

    return await createQueue(queueName, Object.keys(attributes).length > 0 ? attributes : undefined)
  } catch (error) {
    // Queue might already exist
    if (error instanceof Error && error.name === 'QueueAlreadyExists') {
      return await getQueueUrl(queueName)
    }
    throw error
  }
}

/**
 * Deletes a test SQS queue from LocalStack
 *
 * @param queueUrl - URL of the queue to delete
 */
export async function deleteTestQueue(queueUrl: string): Promise<void> {
  try {
    await deleteQueue(queueUrl)
  } catch {
    // Queue might not exist
  }
}

/**
 * Gets the ARN of a queue from its URL
 *
 * @param queueUrl - URL of the queue
 * @returns Queue ARN
 */
export function getQueueArnFromUrl(queueUrl: string): string {
  // Extract queue name from URL
  // URL format: http://localhost:4566/000000000000/queue-name or similar
  const parts = queueUrl.split('/')
  const queueName = parts[parts.length - 1]
  return `arn:aws:sqs:${AWS_REGION}:${AWS_ACCOUNT_ID}:${queueName}`
}

/**
 * Sends a test message to an SQS queue
 *
 * @param queueUrl - URL of the queue
 * @param body - Message body
 * @param attributes - Optional message attributes
 * @param delaySeconds - Optional delay before message is visible
 * @returns MessageId
 */
export async function sendTestMessage(
  queueUrl: string,
  body: string,
  attributes?: Record<string, MessageAttributeValue>,
  delaySeconds?: number
): Promise<string> {
  const result = await sendMessage(queueUrl, body, attributes, delaySeconds)
  return result.MessageId!
}

/**
 * Sends a JSON message to an SQS queue
 *
 * @param queueUrl - URL of the queue
 * @param payload - Object to serialize as JSON
 * @param attributes - Optional message attributes
 * @returns MessageId
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
 *
 * @param queueUrl - URL of the queue
 * @param options - Receive options
 * @returns Array of received messages
 */
export async function receiveTestMessages(
  queueUrl: string,
  options?: {
    maxMessages?: number
    waitTimeSeconds?: number
    visibilityTimeout?: number
  }
): Promise<Message[]> {
  const result = await receiveMessage(
    queueUrl,
    options?.maxMessages ?? 10,
    options?.waitTimeSeconds ?? 0,
    options?.visibilityTimeout
  )
  return result.Messages || []
}

/**
 * Receives a single message from a queue
 *
 * @param queueUrl - URL of the queue
 * @param waitTimeSeconds - How long to wait for a message (default: 5)
 * @returns The message, or null if no message available
 */
export async function receiveOneMessage(queueUrl: string, waitTimeSeconds: number = 5): Promise<Message | null> {
  const messages = await receiveTestMessages(queueUrl, {
    maxMessages: 1,
    waitTimeSeconds
  })
  return messages[0] || null
}

/**
 * Deletes a message from a queue after processing
 *
 * @param queueUrl - URL of the queue
 * @param message - Message to delete (must have ReceiptHandle)
 */
export async function deleteTestMessage(queueUrl: string, message: Message): Promise<void> {
  if (!message.ReceiptHandle) {
    throw new Error('Message must have a ReceiptHandle to delete')
  }
  await deleteMessage(queueUrl, message.ReceiptHandle)
}

/**
 * Drains all messages from a queue (for cleanup)
 *
 * @param queueUrl - URL of the queue
 * @returns Number of messages drained
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
 *
 * Note: SQS limits purge operations to once per 60 seconds.
 * For immediate cleanup, use drainQueue instead.
 *
 * @param queueUrl - URL of the queue to purge
 */
export async function purgeTestQueue(queueUrl: string): Promise<void> {
  try {
    await purgeQueue(queueUrl)
  } catch {
    // Purge might fail if called too frequently
  }
}

/**
 * Gets the approximate number of messages in a queue
 *
 * @param queueUrl - URL of the queue
 * @returns Approximate message count
 */
export async function getMessageCount(queueUrl: string): Promise<number> {
  const attributes = await getQueueAttributes(queueUrl, [QueueAttributeName.ApproximateNumberOfMessages])
  return parseInt(attributes.Attributes?.ApproximateNumberOfMessages || '0', 10)
}

/**
 * Waits for a queue to have at least one message
 *
 * @param queueUrl - URL of the queue
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @returns true if message arrived, false if timeout
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
 *
 * @param value - String value
 * @returns MessageAttributeValue
 */
export function stringAttribute(value: string): MessageAttributeValue {
  return {DataType: 'String', StringValue: value}
}

/**
 * Creates a number message attribute for SQS
 *
 * @param value - Number value
 * @returns MessageAttributeValue
 */
export function numberAttribute(value: number): MessageAttributeValue {
  return {DataType: 'Number', StringValue: value.toString()}
}

// Re-export Message type for convenience
export type {Message}
