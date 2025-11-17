import {SQSClient, SendMessageRequest, SendMessageResult, SendMessageCommand} from '@aws-sdk/client-sqs'

const sqs = new SQSClient()

// Re-export types for application code to use
export type {SendMessageRequest}

export function sendMessage(params: SendMessageRequest): Promise<SendMessageResult> {
  const command = new SendMessageCommand(params)
  return sqs.send(command)
}
