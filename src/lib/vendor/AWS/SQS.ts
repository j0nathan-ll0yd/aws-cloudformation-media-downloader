import {SendMessageCommand} from '@aws-sdk/client-sqs'
import type {MessageAttributeValue, SendMessageRequest, SendMessageResult} from '@aws-sdk/client-sqs'
import type {SQSMessageAttribute, SQSMessageAttributes} from 'aws-lambda'
import {createSQSClient} from './clients'

const sqs = createSQSClient()

// Re-export types for application code to use
// SQSMessageAttribute/Attributes are for RECEIVING messages (aws-lambda event types)
// MessageAttributeValue is for SENDING messages (AWS SDK types)
export type { MessageAttributeValue, SendMessageRequest, SQSMessageAttribute, SQSMessageAttributes }

// Helper functions for building SQS message attributes (for sending messages)
/** */
export function stringAttribute(value: string): MessageAttributeValue {
  return {DataType: 'String', StringValue: value}
}

/** */
export function numberAttribute(value: number): MessageAttributeValue {
  return {DataType: 'Number', StringValue: value.toString()}
}

/** */
export function sendMessage(params: SendMessageRequest): Promise<SendMessageResult> {
  const command = new SendMessageCommand(params)
  return sqs.send(command)
}
