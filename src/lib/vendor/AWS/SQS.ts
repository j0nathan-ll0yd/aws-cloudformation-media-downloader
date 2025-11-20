import {SendMessageRequest, SendMessageResult, SendMessageCommand, SQSClient} from '@aws-sdk/client-sqs'
import {createSQSClient} from './clients'

// Lazy initialization to avoid module-level client creation (breaks Jest mocking)
let sqs: SQSClient | null = null
function getClient(): SQSClient {
  if (!sqs) {
    sqs = createSQSClient()
  }
  return sqs
}

// Re-export types for application code to use
export type {SendMessageRequest}

export function sendMessage(params: SendMessageRequest): Promise<SendMessageResult> {
  const command = new SendMessageCommand(params)
  return getClient().send(command)
}
