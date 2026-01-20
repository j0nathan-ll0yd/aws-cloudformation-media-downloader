/**
 * Vendor Wrapper Permission Decorators
 *
 * Method decorators for declaring AWS service permissions on vendor wrapper functions.
 * These decorators attach permission metadata that is extracted at build time
 * to generate Lambda IAM policies automatically.
 *
 * Usage:
 * - Apply decorators to static class methods in vendor wrapper files
 * - Extraction script traces Lambda call graphs and aggregates permissions
 * - Generated permissions flow to Terraform IAM policies
 *
 * @see docs/wiki/Infrastructure/Lambda-Decorators.md
 */
import type {ServicePermission} from '#types/servicePermissions'
import {ApiGatewayOperation, AWSService, EventBridgeOperation, LambdaOperation, S3Operation, SNSOperation, SQSOperation} from '#types/servicePermissions'
import type {EventBridgeResource, S3Resource, SNSPlatformResource, SNSTopicResource, SQSResource} from '#types/generatedResources'

/**
 * Type for methods that can have permission metadata attached.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any

/**
 * Type augmentation for methods with permission metadata.
 * The decorator attaches permissions as a property on the method.
 */
export interface WithMethodPermissions {
  __permissions?: ServicePermission[]
}

/**
 * Method decorator that declares SNS permissions.
 * Supports both topic and platform application resources.
 *
 * @param resource - SNS topic or platform application resource enum value
 * @param operations - Array of SNS operations required
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * class SNSVendor {
 *   @RequiresSNS(SNSTopicResource.PushNotifications, [SNSOperation.Subscribe])
 *   static async subscribe(params: SubscribeInput) {...}
 * }
 * ```
 */
export function RequiresSNS(resource: SNSTopicResource | SNSPlatformResource, operations: SNSOperation[]) {
  return function(_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value as AnyFunction & WithMethodPermissions
    method.__permissions = [{service: AWSService.SNS, resource, operations}]
    return descriptor
  }
}

/**
 * Method decorator that declares S3 permissions.
 *
 * @param resource - S3 bucket resource enum value
 * @param operations - Array of S3 operations required
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * class S3Vendor {
 *   @RequiresS3(S3Resource.Files, [S3Operation.GetObject, S3Operation.PutObject])
 *   static async uploadFile(bucket: string, key: string) {...}
 * }
 * ```
 */
export function RequiresS3(resource: S3Resource | `${S3Resource}/*`, operations: S3Operation[]) {
  return function(_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value as AnyFunction & WithMethodPermissions
    method.__permissions = [{service: AWSService.S3, resource, operations}]
    return descriptor
  }
}

/**
 * Method decorator that declares SQS permissions.
 *
 * @param resource - SQS queue resource enum value
 * @param operations - Array of SQS operations required
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * class SQSVendor {
 *   @RequiresSQS(SQSResource.SendPushNotification, [SQSOperation.SendMessage])
 *   static async sendMessage(queueUrl: string, message: string) {...}
 * }
 * ```
 */
export function RequiresSQS(resource: SQSResource, operations: SQSOperation[]) {
  return function(_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value as AnyFunction & WithMethodPermissions
    method.__permissions = [{service: AWSService.SQS, resource, operations}]
    return descriptor
  }
}

/**
 * Method decorator that declares EventBridge permissions.
 *
 * @param resource - EventBridge event bus resource enum value
 * @param operations - Array of EventBridge operations required
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * class EventBridgeVendor {
 *   @RequiresEventBridge(EventBridgeResource.MediaDownloader, [EventBridgeOperation.PutEvents])
 *   static async publishEvent(detail: object) {...}
 * }
 * ```
 */
export function RequiresEventBridge(resource: EventBridgeResource, operations: EventBridgeOperation[]) {
  return function(_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value as AnyFunction & WithMethodPermissions
    method.__permissions = [{service: AWSService.EventBridge, resource, operations}]
    return descriptor
  }
}

/**
 * Method decorator that declares API Gateway permissions.
 * API Gateway uses different resource patterns - typically the entire API or specific resources.
 *
 * @param resource - API Gateway resource pattern (e.g., '*' for all APIs)
 * @param operations - Array of API Gateway operations required
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * class ApiGatewayVendor {
 *   @RequiresApiGateway('*', [ApiGatewayOperation.GetApiKeys])
 *   static async getApiKeys() {...}
 * }
 * ```
 */
export function RequiresApiGateway(resource: string, operations: ApiGatewayOperation[]) {
  return function(_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value as AnyFunction & WithMethodPermissions
    method.__permissions = [{service: AWSService.ApiGateway, resource, operations}]
    return descriptor
  }
}

/**
 * Method decorator that declares Lambda invocation permissions.
 * Used for Lambda-to-Lambda invocation patterns.
 *
 * @param resource - Lambda function ARN pattern (e.g., '*' or specific function ARN)
 * @param operations - Array of Lambda operations required
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * class LambdaVendor {
 *   @RequiresLambda('*', [LambdaOperation.Invoke])
 *   static async invokeLambda(functionName: string, payload: object) {...}
 * }
 * ```
 */
export function RequiresLambda(resource: string, operations: LambdaOperation[]) {
  return function(_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value as AnyFunction & WithMethodPermissions
    method.__permissions = [{service: AWSService.Lambda, resource, operations}]
    return descriptor
  }
}
