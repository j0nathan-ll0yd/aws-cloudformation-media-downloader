/**
 * SQS Test Helpers
 *
 * Utilities for creating SQS queues and receiving messages in LocalStack.
 * Used for integration testing message-based workflows.
 */

import {
  CreateQueueCommand,
  DeleteMessageCommand,
  DeleteQueueCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  SQSClient
} from '@aws-sdk/client-sqs'
import type {Message} from '@aws-sdk/client-sqs'

const AWS_REGION = process.env.AWS_REGION || 'us-west-2'

const sqsClient = new SQSClient({
  region: AWS_REGION,
  endpoint: 'http://localhost:4566',
  credentials: {accessKeyId: 'test', secretAccessKey: 'test'}
})

/**
 * Creates a test SQS queue in LocalStack
 */
export async function createTestQueue(queueName: string): Promise<string> {
  const result = await sqsClient.send(new CreateQueueCommand({QueueName: queueName}))
  return result.QueueUrl!
}

/**
 * Gets the URL of an existing queue
 */
export async function getQueueUrl(queueName: string): Promise<string> {
  const result = await sqsClient.send(new GetQueueUrlCommand({QueueName: queueName}))
  return result.QueueUrl!
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
 * Purges all messages from a queue
 */
export async function purgeQueue(queueUrl: string): Promise<void> {
  try {
    await sqsClient.send(new PurgeQueueCommand({QueueUrl: queueUrl}))
  } catch {
    // Queue might be empty or not exist
  }
}

/**
 * Receives messages from a queue (non-blocking, returns immediately if empty)
 */
export async function receiveMessages(queueUrl: string, options?: {maxMessages?: number; waitTimeSeconds?: number}): Promise<Message[]> {
  const result = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: options?.maxMessages ?? 10,
      WaitTimeSeconds: options?.waitTimeSeconds ?? 0,
      MessageAttributeNames: ['All'],
      AttributeNames: ['All']
    })
  )
  return result.Messages || []
}

/**
 * Deletes a message from a queue after processing
 */
export async function deleteMessage(queueUrl: string, receiptHandle: string): Promise<void> {
  await sqsClient.send(new DeleteMessageCommand({QueueUrl: queueUrl, ReceiptHandle: receiptHandle}))
}

/**
 * Gets the approximate number of messages in a queue
 */
export async function getQueueMessageCount(queueUrl: string): Promise<number> {
  const result = await sqsClient.send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['ApproximateNumberOfMessages']
    })
  )
  return parseInt(result.Attributes?.ApproximateNumberOfMessages || '0', 10)
}

/**
 * Waits for a specific number of messages to appear in the queue
 * Useful for asserting that messages were sent
 */
export async function waitForMessages(queueUrl: string, expectedCount: number, timeoutMs: number = 5000): Promise<Message[]> {
  const startTime = Date.now()
  const allMessages: Message[] = []

  while (Date.now() - startTime < timeoutMs) {
    const messages = await receiveMessages(queueUrl, {maxMessages: 10, waitTimeSeconds: 1})
    allMessages.push(...messages)

    if (allMessages.length >= expectedCount) {
      return allMessages
    }

    // Small delay before retrying
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return allMessages
}
