/**
 * SNS Vendor Wrapper
 *
 * Encapsulates AWS SNS SDK operations with declarative permission metadata.
 * Each method declares the AWS permissions it requires via decorators.
 * Permissions are extracted at build time to generate Lambda IAM policies.
 *
 * @see src/lib/vendor/AWS/clients.ts for client factory
 * @see src/lib/vendor/AWS/decorators.ts for permission decorators
 */
import {
  CreatePlatformEndpointCommand,
  DeleteEndpointCommand,
  ListSubscriptionsByTopicCommand,
  PublishCommand,
  SubscribeCommand,
  UnsubscribeCommand
} from '@aws-sdk/client-sns'
import type {
  CreateEndpointResponse,
  CreatePlatformEndpointInput,
  DeleteEndpointInput,
  ListSubscriptionsByTopicInput,
  ListSubscriptionsByTopicResponse,
  PublishInput,
  PublishResponse,
  SubscribeInput,
  SubscribeResponse,
  UnsubscribeInput
} from '@aws-sdk/client-sns'
import {createSNSClient} from './clients'
import {RequiresSNS} from './decorators'
import {SNSPlatformResource, SNSTopicResource} from '#types/generatedResources'
import {SNSOperation} from '#types/servicePermissions'

const snsClient = createSNSClient()

// Re-export types for application code to use
export type { PublishInput }

/**
 * SNS vendor wrapper with declarative permission metadata.
 * Each method declares the AWS permissions it requires via decorators.
 * Permissions are extracted at build time to generate Lambda IAM policies.
 */
/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
class SNSVendor {
  @RequiresSNS(SNSPlatformResource.OfflineMediaDownloader, [SNSOperation.Publish])
  static publishSnsEvent(params: PublishInput): Promise<PublishResponse> {
    const command = new PublishCommand(params)
    return snsClient.send(command)
  }

  @RequiresSNS(SNSTopicResource.PushNotifications, [SNSOperation.Subscribe])
  static subscribe(params: SubscribeInput): Promise<SubscribeResponse> {
    const command = new SubscribeCommand(params)
    return snsClient.send(command)
  }

  @RequiresSNS(SNSTopicResource.PushNotifications, [SNSOperation.ListSubscriptionsByTopic])
  static listSubscriptionsByTopic(params: ListSubscriptionsByTopicInput): Promise<ListSubscriptionsByTopicResponse> {
    const command = new ListSubscriptionsByTopicCommand(params)
    return snsClient.send(command)
  }

  @RequiresSNS(SNSPlatformResource.OfflineMediaDownloader, [SNSOperation.CreatePlatformEndpoint])
  static createPlatformEndpoint(params: CreatePlatformEndpointInput): Promise<CreateEndpointResponse> {
    const command = new CreatePlatformEndpointCommand(params)
    return snsClient.send(command)
  }

  @RequiresSNS(SNSTopicResource.PushNotifications, [SNSOperation.Unsubscribe])
  static unsubscribe(params: UnsubscribeInput): Promise<object> {
    const command = new UnsubscribeCommand(params)
    return snsClient.send(command)
  }

  @RequiresSNS(SNSPlatformResource.OfflineMediaDownloader, [SNSOperation.DeleteEndpoint])
  static deleteEndpoint(params: DeleteEndpointInput): Promise<object> {
    const command = new DeleteEndpointCommand(params)
    return snsClient.send(command)
  }
}
/* c8 ignore stop */

// Export static methods for backwards compatibility with existing imports
export const publishSnsEvent = SNSVendor.publishSnsEvent.bind(SNSVendor)
export const subscribe = SNSVendor.subscribe.bind(SNSVendor)
export const listSubscriptionsByTopic = SNSVendor.listSubscriptionsByTopic.bind(SNSVendor)
export const createPlatformEndpoint = SNSVendor.createPlatformEndpoint.bind(SNSVendor)
export const unsubscribe = SNSVendor.unsubscribe.bind(SNSVendor)
export const deleteEndpoint = SNSVendor.deleteEndpoint.bind(SNSVendor)

// Export class for extraction script access
export { SNSVendor }
