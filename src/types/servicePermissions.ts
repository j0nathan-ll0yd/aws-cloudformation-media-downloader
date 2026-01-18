/**
 * AWS Service Permission Types for Lambda Handlers
 *
 * These types enable explicit declaration of AWS service dependencies
 * in Lambda handler code via the @RequiresServices decorator.
 *
 * The declared permissions are extracted at build time and used to:
 * - Generate IAM policy statements for S3, SQS, SNS, EventBridge
 * - Validate that declared services match actual vendor wrapper imports
 * - Document infrastructure dependencies in code
 *
 * @see docs/wiki/Infrastructure/Lambda-Decorators.md
 */

/**
 * AWS service types for Lambda handlers.
 * Maps to AWS service prefixes used in IAM policies.
 */
export enum AWSService {
  S3 = 's3',
  SQS = 'sqs',
  SNS = 'sns',
  EventBridge = 'events'
}

/**
 * S3 operation types matching IAM action names.
 */
export enum S3Operation {
  GetObject = 's3:GetObject',
  PutObject = 's3:PutObject',
  DeleteObject = 's3:DeleteObject',
  ListBucket = 's3:ListBucket',
  HeadObject = 's3:HeadObject'
}

/**
 * SQS operation types matching IAM action names.
 */
export enum SQSOperation {
  SendMessage = 'sqs:SendMessage',
  ReceiveMessage = 'sqs:ReceiveMessage',
  DeleteMessage = 'sqs:DeleteMessage',
  GetQueueAttributes = 'sqs:GetQueueAttributes',
  GetQueueUrl = 'sqs:GetQueueUrl'
}

/**
 * SNS operation types matching IAM action names.
 */
export enum SNSOperation {
  Publish = 'sns:Publish',
  Subscribe = 'sns:Subscribe'
}

/**
 * EventBridge operation types matching IAM action names.
 */
export enum EventBridgeOperation {
  PutEvents = 'events:PutEvents'
}

/**
 * Permission declaration for a single AWS service.
 * Specifies which operations are required and on which resources.
 */
export interface ServicePermission {
  /** The AWS service being accessed */
  service: AWSService
  /** Resource ARN pattern or resource name (supports wildcards) */
  resource: string
  /** The operations required on this resource */
  operations: (S3Operation | SQSOperation | SNSOperation | EventBridgeOperation | string)[]
}

/**
 * Service permissions declaration for a Lambda handler.
 * An array of service permissions specifying required access.
 *
 * @example
 * ```typescript
 * import {AWSService, S3Operation, SQSOperation} from '#types/servicePermissions'
 *
 * @RequiresServices([
 *   {service: AWSService.S3, resource: 'media-bucket/*', operations: [S3Operation.GetObject, S3Operation.PutObject]},
 *   {service: AWSService.SQS, resource: 'download-queue', operations: [SQSOperation.SendMessage]}
 * ])
 * class MyHandler extends ApiHandler { ... }
 * ```
 */
export type ServicePermissions = ServicePermission[]

/**
 * Type augmentation for handler classes with service permissions metadata.
 * The decorator attaches permissions as a static property.
 */
export interface WithServicePermissions {
  __servicePermissions?: ServicePermissions
}

/**
 * Constant name for Lambda service permissions export.
 * Used by the extraction script to find permissions declarations.
 */
export const SERVICE_PERMISSIONS_EXPORT_NAME = 'SERVICE_PERMISSIONS'
