/**
 * SQS Test Vendor Wrapper
 *
 * Encapsulates AWS SDK SQS operations used in integration tests.
 * This wrapper exists to maintain the AWS SDK Encapsulation Policy even in test code.
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
  SendMessageCommand
} from '@aws-sdk/client-sqs'
import type {GetQueueAttributesResult, Message, MessageAttributeValue, ReceiveMessageResult, SendMessageResult} from '@aws-sdk/client-sqs'
import {createSQSClient} from '#lib/vendor/AWS/clients'

const sqsClient = createSQSClient()

/**
 * Creates an SQS queue
 *
 * @param queueName - Name of the queue to create
 * @param attributes - Optional queue attributes (e.g., VisibilityTimeout, DelaySeconds)
 * @returns Queue URL
 */
export async function createQueue(queueName: string, attributes?: Record<string, string>): Promise<string> {
  const result = await sqsClient.send(new CreateQueueCommand({QueueName: queueName, Attributes: attributes}))
  return result.QueueUrl!
}

/**
 * Deletes an SQS queue
 *
 * @param queueUrl - URL of the queue to delete
 */
export async function deleteQueue(queueUrl: string): Promise<void> {
  await sqsClient.send(new DeleteQueueCommand({QueueUrl: queueUrl}))
}

/**
 * Gets the URL of a queue by name
 *
 * @param queueName - Name of the queue
 * @returns Queue URL
 */
export async function getQueueUrl(queueName: string): Promise<string> {
  const result = await sqsClient.send(new GetQueueUrlCommand({QueueName: queueName}))
  return result.QueueUrl!
}

/**
 * Gets queue attributes
 *
 * @param queueUrl - URL of the queue
 * @param attributeNames - Names of attributes to retrieve (default: All)
 * @returns Queue attributes
 */
export async function getQueueAttributes(
  queueUrl: string,
  attributeNames: QueueAttributeName[] = [QueueAttributeName.All]
): Promise<GetQueueAttributesResult> {
  return sqsClient.send(new GetQueueAttributesCommand({QueueUrl: queueUrl, AttributeNames: attributeNames}))
}

/**
 * Sends a message to a queue
 *
 * @param queueUrl - URL of the queue
 * @param messageBody - Message content
 * @param messageAttributes - Optional message attributes
 * @param delaySeconds - Optional delay before message becomes visible
 * @returns Send result with MessageId
 */
export async function sendMessage(
  queueUrl: string,
  messageBody: string,
  messageAttributes?: Record<string, MessageAttributeValue>,
  delaySeconds?: number
): Promise<SendMessageResult> {
  return sqsClient.send(
    new SendMessageCommand({QueueUrl: queueUrl, MessageBody: messageBody, MessageAttributes: messageAttributes, DelaySeconds: delaySeconds})
  )
}

/**
 * Receives messages from a queue
 *
 * @param queueUrl - URL of the queue
 * @param maxMessages - Maximum number of messages to receive (1-10)
 * @param waitTimeSeconds - Long polling wait time (0-20)
 * @param visibilityTimeout - How long received messages are hidden from subsequent requests
 * @returns Received messages
 */
export async function receiveMessage(
  queueUrl: string,
  maxMessages: number = 1,
  waitTimeSeconds: number = 0,
  visibilityTimeout?: number
): Promise<ReceiveMessageResult> {
  return sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: waitTimeSeconds,
      VisibilityTimeout: visibilityTimeout,
      MessageAttributeNames: ['All'],
      AttributeNames: ['All']
    })
  )
}

/**
 * Deletes a message from a queue
 *
 * @param queueUrl - URL of the queue
 * @param receiptHandle - Receipt handle from receive operation
 */
export async function deleteMessage(queueUrl: string, receiptHandle: string): Promise<void> {
  await sqsClient.send(new DeleteMessageCommand({QueueUrl: queueUrl, ReceiptHandle: receiptHandle}))
}

/**
 * Purges all messages from a queue
 *
 * @param queueUrl - URL of the queue to purge
 */
export async function purgeQueue(queueUrl: string): Promise<void> {
  await sqsClient.send(new PurgeQueueCommand({QueueUrl: queueUrl}))
}

// Re-export types and enums for convenience
export type { Message, MessageAttributeValue }
export { QueueAttributeName }
