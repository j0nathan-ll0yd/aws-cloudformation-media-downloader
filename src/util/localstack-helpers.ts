/**
 * LocalStack Helper Utilities
 *
 * This module provides helper functions for working with LocalStack,
 * a local AWS cloud stack emulator for development and testing.
 */

import {S3Client, S3ClientConfig} from '@aws-sdk/client-s3'
import {DynamoDBClient, DynamoDBClientConfig} from '@aws-sdk/client-dynamodb'
import {SNSClient, SNSClientConfig} from '@aws-sdk/client-sns'
import {SQSClient, SQSClientConfig} from '@aws-sdk/client-sqs'

const LOCALSTACK_ENDPOINT = 'http://localhost:4566'

/**
 * Get the base configuration for LocalStack AWS clients
 * @returns Base configuration object for AWS SDK clients
 */
export function getLocalStackConfig(): {
  endpoint: string
  region: string
  credentials: {accessKeyId: string; secretAccessKey: string}
} {
  return {
    endpoint: LOCALSTACK_ENDPOINT,
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test'
    }
  }
}

/**
 * Create an S3 client configured for LocalStack
 * @returns S3Client instance configured for LocalStack
 */
export function createLocalS3Client(): S3Client {
  const config: S3ClientConfig = {
    ...getLocalStackConfig(),
    forcePathStyle: true // Required for LocalStack S3
  }
  return new S3Client(config)
}

/**
 * Create a DynamoDB client configured for LocalStack
 * @returns DynamoDBClient instance configured for LocalStack
 */
export function createLocalDynamoDBClient(): DynamoDBClient {
  const config: DynamoDBClientConfig = getLocalStackConfig()
  return new DynamoDBClient(config)
}

/**
 * Create an SNS client configured for LocalStack
 * @returns SNSClient instance configured for LocalStack
 */
export function createLocalSNSClient(): SNSClient {
  const config: SNSClientConfig = getLocalStackConfig()
  return new SNSClient(config)
}

/**
 * Create an SQS client configured for LocalStack
 * @returns SQSClient instance configured for LocalStack
 */
export function createLocalSQSClient(): SQSClient {
  const config: SQSClientConfig = getLocalStackConfig()
  return new SQSClient(config)
}

/**
 * Check if the application is running in LocalStack mode
 * @returns true if USE_LOCALSTACK environment variable is set to 'true'
 */
export function isLocalStackMode(): boolean {
  return process.env.USE_LOCALSTACK === 'true'
}
