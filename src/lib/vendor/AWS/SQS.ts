import {SQSClient, SendMessageRequest, SendMessageResult, SendMessageCommand} from '@aws-sdk/client-sqs'
import AWSXRay from 'aws-xray-sdk-core'

const enableXRay = process.env.ENABLE_XRAY !== 'false'
const baseClient = new SQSClient()
const sqs = enableXRay ? AWSXRay.captureAWSv3Client(baseClient) : baseClient

// Re-export types for application code to use
export type {SendMessageRequest}

export function sendMessage(params: SendMessageRequest): Promise<SendMessageResult> {
  const command = new SendMessageCommand(params)
  return sqs.send(command)
}
