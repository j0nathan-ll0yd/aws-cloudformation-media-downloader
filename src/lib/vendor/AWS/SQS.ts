import {SendMessageRequest, SendMessageResult, SendMessageCommand, SQSClient} from '@aws-sdk/client-sqs'
import {createSQSClient} from './clients'

const sqs = createSQSClient()

// Re-export types for application code to use
export type {SendMessageRequest}

export function sendMessage(params: SendMessageRequest): Promise<SendMessageResult> {
  const command = new SendMessageCommand(params)
  return sqs.send(command)
}
