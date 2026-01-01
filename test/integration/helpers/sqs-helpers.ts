/**
 * SQS Test Helpers
 *
 * Utilities for creating queues and receiving messages in LocalStack.
 * Used for integration testing event-driven workflows.
 */
import {createQueue, deleteMessage, deleteQueue, getQueueArn, getQueueUrl, purgeQueue, receiveMessages} from '../lib/vendor/AWS/SQS'
import type {Message} from '@aws-sdk/client-sqs'

/**
 * Creates a test SQS queue in LocalStack
 * @param queueName - Name of the queue
 * @returns Object with queueUrl and queueArn
 */
export async function createTestQueue(queueName: string): Promise<{queueUrl: string; queueArn: string}> {
  try {
    const queueUrl = await createQueue(queueName)
    const queueArn = await getQueueArn(queueUrl)
    return {queueUrl, queueArn}
  } catch (error) {
    if (error instanceof Error && error.name === 'QueueAlreadyExists') {
      const queueUrl = await getQueueUrl(queueName)
      const queueArn = await getQueueArn(queueUrl)
      return {queueUrl, queueArn}
    }
    throw error
  }
}

/**
 * Deletes a test SQS queue from LocalStack
 * @param queueUrl - URL of the queue
 */
export async function deleteTestQueue(queueUrl: string): Promise<void> {
  try {
    await deleteQueue(queueUrl)
  } catch {
    // Queue might not exist
  }
}

/**
 * Receives and deletes messages from a queue
 * @param queueUrl - URL of the queue
 * @param maxMessages - Maximum messages to receive
 * @param waitTimeSeconds - Long polling wait time
 * @returns Array of message bodies (parsed as JSON if possible)
 */
export async function receiveAndDeleteMessages(
  queueUrl: string,
  maxMessages = 10,
  waitTimeSeconds = 5
): Promise<Array<{body: unknown; attributes: Record<string, string>}>> {
  const messages = await receiveMessages(queueUrl, maxMessages, waitTimeSeconds)
  const results: Array<{body: unknown; attributes: Record<string, string>}> = []
  for (const message of messages) {
    let body: unknown
    try {
      body = JSON.parse(message.Body || '{}')
    } catch {
      body = message.Body
    }
    const attributes: Record<string, string> = {}
    if (message.MessageAttributes) {
      for (const [key, value] of Object.entries(message.MessageAttributes)) {
        if (value.StringValue) {
          attributes[key] = value.StringValue
        }
      }
    }
    results.push({body, attributes})
    if (message.ReceiptHandle) {
      await deleteMessage(queueUrl, message.ReceiptHandle)
    }
  }
  return results
}

/**
 * Waits for messages to arrive in a queue with timeout
 * @param queueUrl - URL of the queue
 * @param expectedCount - Number of messages to wait for
 * @param timeoutMs - Maximum wait time in milliseconds
 * @returns Array of raw SQS messages
 */
export async function waitForMessages(queueUrl: string, expectedCount: number, timeoutMs = 30000): Promise<Message[]> {
  const startTime = Date.now()
  const allMessages: Message[] = []
  while (allMessages.length < expectedCount && Date.now() - startTime < timeoutMs) {
    const messages = await receiveMessages(queueUrl, expectedCount - allMessages.length, 2)
    allMessages.push(...messages)
    if (allMessages.length < expectedCount) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  return allMessages
}

/**
 * Clears all messages from a queue
 * @param queueUrl - URL of the queue
 */
export async function clearTestQueue(queueUrl: string): Promise<void> {
  try {
    await purgeQueue(queueUrl)
  } catch {
    // Queue might not exist or purge recently attempted
  }
}
