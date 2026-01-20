/**
 * SQS Vendor Wrapper
 *
 * Encapsulates AWS SQS SDK operations with declarative permission metadata.
 * Each method declares the AWS permissions it requires via decorators.
 * Permissions are extracted at build time to generate Lambda IAM policies.
 *
 * @see src/lib/vendor/AWS/clients.ts for client factory
 * @see src/lib/vendor/AWS/decorators.ts for permission decorators
 */
import {SendMessageCommand} from '@aws-sdk/client-sqs'
import type {MessageAttributeValue, SendMessageRequest, SendMessageResult} from '@aws-sdk/client-sqs'
import type {SQSMessageAttribute, SQSMessageAttributes} from 'aws-lambda'
import {createSQSClient} from './clients'
import {RequiresSQS} from './decorators'
import {SQSResource} from '#types/generatedResources'
import {SQSOperation} from '#types/servicePermissions'

const sqs = createSQSClient()

// Re-export types for application code to use
// SQSMessageAttribute/Attributes are for RECEIVING messages (aws-lambda event types)
// MessageAttributeValue is for SENDING messages (AWS SDK types)
export type { MessageAttributeValue, SendMessageRequest, SQSMessageAttribute, SQSMessageAttributes }

/**
 * Helper function to create a string message attribute.
 * Used for constructing SQS message attributes.
 */
export function stringAttribute(value: string): MessageAttributeValue {
  return {DataType: 'String', StringValue: value}
}

/**
 * Helper function to create a number message attribute.
 * Used for constructing SQS message attributes.
 */
export function numberAttribute(value: number): MessageAttributeValue {
  return {DataType: 'Number', StringValue: value.toString()}
}

/**
 * SQS vendor wrapper with declarative permission metadata.
 * Each method declares the AWS permissions it requires via decorators.
 * Permissions are extracted at build time to generate Lambda IAM policies.
 *
 * Note: sendMessage targets the SendPushNotification queue.
 * All current usages send to SNS_QUEUE_URL which maps to this queue.
 */
/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
class SQSVendor {
  @RequiresSQS(SQSResource.SendPushNotification, [SQSOperation.SendMessage])
  static sendMessage(params: SendMessageRequest): Promise<SendMessageResult> {
    const command = new SendMessageCommand(params)
    return sqs.send(command)
  }
}
/* c8 ignore stop */

// Export static methods for backwards compatibility with existing imports
export const sendMessage = SQSVendor.sendMessage.bind(SQSVendor)

// Export class for extraction script access
export { SQSVendor }
