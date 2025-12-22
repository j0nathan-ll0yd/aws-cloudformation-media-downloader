/**
 * AWS Client Factory
 *
 * Creates AWS SDK clients with environment-aware configuration.
 * Supports both production AWS and LocalStack for integration testing.
 *
 * This is the ONLY file where AWS SDK client instantiation should occur,
 * maintaining the AWS SDK Encapsulation Policy.
 *
 * NOTE: AWS SDK calls are automatically traced via OpenTelemetry's AwsInstrumentation.
 * No manual X-Ray wrapping is needed.
 */

import {S3Client} from '@aws-sdk/client-s3'
import type {S3ClientConfig} from '@aws-sdk/client-s3'
import {DynamoDBClient} from '@aws-sdk/client-dynamodb'
import type {DynamoDBClientConfig} from '@aws-sdk/client-dynamodb'
import {SNSClient} from '@aws-sdk/client-sns'
import type {SNSClientConfig} from '@aws-sdk/client-sns'
import {SQSClient} from '@aws-sdk/client-sqs'
import type {SQSClientConfig} from '@aws-sdk/client-sqs'
import {LambdaClient} from '@aws-sdk/client-lambda'
import type {LambdaClientConfig} from '@aws-sdk/client-lambda'
import {CloudWatchClient} from '@aws-sdk/client-cloudwatch'
import type {CloudWatchClientConfig} from '@aws-sdk/client-cloudwatch'
import {APIGateway} from '@aws-sdk/client-api-gateway'
import type {APIGatewayClientConfig} from '@aws-sdk/client-api-gateway'
import {EventBridgeClient} from '@aws-sdk/client-eventbridge'
import type {EventBridgeClientConfig} from '@aws-sdk/client-eventbridge'

const LOCALSTACK_ENDPOINT = 'http://localhost:4566'
const AWS_REGION = process.env.AWS_REGION || 'us-west-2'

/**
 * Check if running in LocalStack mode
 * @returns true if USE_LOCALSTACK environment variable is set to 'true'
 */
function isLocalStackMode(): boolean {
  return process.env.USE_LOCALSTACK === 'true'
}

/**
 * Get base configuration for AWS clients
 * Returns LocalStack config when in LocalStack mode, production config otherwise
 */
function getBaseConfig() {
  if (isLocalStackMode()) {
    return {endpoint: LOCALSTACK_ENDPOINT, region: AWS_REGION, credentials: {accessKeyId: 'test', secretAccessKey: 'test'}}
  }

  return {region: AWS_REGION}
}

/**
 * Create an S3 client instance
 * Configured for LocalStack when USE_LOCALSTACK=true, otherwise production AWS
 * Automatically traced via OpenTelemetry AwsInstrumentation
 */
export function createS3Client(): S3Client {
  const config: S3ClientConfig = {
    ...getBaseConfig(),
    // forcePathStyle required for LocalStack S3
    forcePathStyle: isLocalStackMode()
  }

  return new S3Client(config)
}

/**
 * Create a DynamoDB client instance
 * Configured for LocalStack when USE_LOCALSTACK=true, otherwise production AWS
 * Automatically traced via OpenTelemetry AwsInstrumentation
 */
export function createDynamoDBClient(): DynamoDBClient {
  const config: DynamoDBClientConfig = getBaseConfig()
  return new DynamoDBClient(config)
}

/**
 * Create an SNS client instance
 * Configured for LocalStack when USE_LOCALSTACK=true, otherwise production AWS
 * Automatically traced via OpenTelemetry AwsInstrumentation
 */
export function createSNSClient(): SNSClient {
  const config: SNSClientConfig = getBaseConfig()
  return new SNSClient(config)
}

/**
 * Create an SQS client instance
 * Configured for LocalStack when USE_LOCALSTACK=true, otherwise production AWS
 * Automatically traced via OpenTelemetry AwsInstrumentation
 */
export function createSQSClient(): SQSClient {
  const config: SQSClientConfig = getBaseConfig()
  return new SQSClient(config)
}

/**
 * Create a Lambda client instance
 * Configured for LocalStack when USE_LOCALSTACK=true, otherwise production AWS
 * Automatically traced via OpenTelemetry AwsInstrumentation
 */
export function createLambdaClient(): LambdaClient {
  const config: LambdaClientConfig = getBaseConfig()
  return new LambdaClient(config)
}

/**
 * Create a CloudWatch client instance
 * Configured for LocalStack when USE_LOCALSTACK=true, otherwise production AWS
 * Automatically traced via OpenTelemetry AwsInstrumentation
 */
export function createCloudWatchClient(): CloudWatchClient {
  const config: CloudWatchClientConfig = getBaseConfig()
  return new CloudWatchClient(config)
}

/**
 * Create an API Gateway client instance
 * Configured for LocalStack when USE_LOCALSTACK=true, otherwise production AWS
 * Automatically traced via OpenTelemetry AwsInstrumentation
 */
export function createAPIGatewayClient(): APIGateway {
  const config: APIGatewayClientConfig = getBaseConfig()
  return new APIGateway(config)
}

/**
 * Create an EventBridge client instance
 * Configured for LocalStack when USE_LOCALSTACK=true, otherwise production AWS
 * Automatically traced via OpenTelemetry AwsInstrumentation
 */
export function createEventBridgeClient(): EventBridgeClient {
  const config: EventBridgeClientConfig = getBaseConfig()
  return new EventBridgeClient(config)
}
