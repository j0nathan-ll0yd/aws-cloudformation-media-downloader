/**
 * AWS Client Factory
 *
 * Creates AWS SDK clients with environment-aware configuration.
 * Supports both production AWS and LocalStack for integration testing.
 *
 * This is the ONLY file where AWS SDK client instantiation should occur,
 * maintaining the AWS SDK Encapsulation Policy.
 */

import {S3Client, S3ClientConfig} from '@aws-sdk/client-s3'
import {DynamoDBClient, DynamoDBClientConfig} from '@aws-sdk/client-dynamodb'
import {SNSClient, SNSClientConfig} from '@aws-sdk/client-sns'
import {SQSClient, SQSClientConfig} from '@aws-sdk/client-sqs'
import {LambdaClient, LambdaClientConfig} from '@aws-sdk/client-lambda'
import {CloudWatchClient, CloudWatchClientConfig} from '@aws-sdk/client-cloudwatch'
import {APIGateway, APIGatewayClientConfig} from '@aws-sdk/client-api-gateway'
import {captureAWSClient} from './XRay'

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
    return {
      endpoint: LOCALSTACK_ENDPOINT,
      region: 'us-west-2',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
      }
    }
  }

  return {
    region: AWS_REGION
  }
}

/**
 * Create an S3 client instance
 * Configured for LocalStack when USE_LOCALSTACK=true, otherwise production AWS
 * Wrapped with X-Ray instrumentation when enabled
 */
export function createS3Client(): S3Client {
  const config: S3ClientConfig = {
    ...getBaseConfig(),
    // forcePathStyle required for LocalStack S3
    forcePathStyle: isLocalStackMode()
  }

  const client = new S3Client(config)
  return captureAWSClient(client)
}

/**
 * Create a DynamoDB client instance
 * Configured for LocalStack when USE_LOCALSTACK=true, otherwise production AWS
 * Wrapped with X-Ray instrumentation when enabled
 */
export function createDynamoDBClient(): DynamoDBClient {
  const config: DynamoDBClientConfig = getBaseConfig()
  const client = new DynamoDBClient(config)
  return captureAWSClient(client)
}

/**
 * Create an SNS client instance
 * Configured for LocalStack when USE_LOCALSTACK=true, otherwise production AWS
 * Wrapped with X-Ray instrumentation when enabled
 */
export function createSNSClient(): SNSClient {
  const config: SNSClientConfig = getBaseConfig()
  const client = new SNSClient(config)
  return captureAWSClient(client)
}

/**
 * Create an SQS client instance
 * Configured for LocalStack when USE_LOCALSTACK=true, otherwise production AWS
 * Wrapped with X-Ray instrumentation when enabled
 */
export function createSQSClient(): SQSClient {
  const config: SQSClientConfig = getBaseConfig()
  const client = new SQSClient(config)
  return captureAWSClient(client)
}

/**
 * Create a Lambda client instance
 * Configured for LocalStack when USE_LOCALSTACK=true, otherwise production AWS
 * Wrapped with X-Ray instrumentation when enabled
 */
export function createLambdaClient(): LambdaClient {
  const config: LambdaClientConfig = getBaseConfig()
  const client = new LambdaClient(config)
  return captureAWSClient(client)
}

/**
 * Create a CloudWatch client instance
 * Configured for LocalStack when USE_LOCALSTACK=true, otherwise production AWS
 * Wrapped with X-Ray instrumentation when enabled
 */
export function createCloudWatchClient(): CloudWatchClient {
  const config: CloudWatchClientConfig = getBaseConfig()
  const client = new CloudWatchClient(config)
  return captureAWSClient(client)
}

/**
 * Create an API Gateway client instance
 * Configured for LocalStack when USE_LOCALSTACK=true, otherwise production AWS
 * Wrapped with X-Ray instrumentation when enabled
 */
export function createAPIGatewayClient(): APIGateway {
  const config: APIGatewayClientConfig = getBaseConfig()
  const client = new APIGateway(config)
  return captureAWSClient(client)
}
