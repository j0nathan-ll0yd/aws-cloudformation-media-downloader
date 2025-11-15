/**
 * LocalStack Resource Setup Script
 *
 * This script initializes LocalStack with the necessary AWS resources
 * (S3 buckets, DynamoDB tables, SNS topics, SQS queues) for integration testing.
 */

import {CreateBucketCommand} from '@aws-sdk/client-s3'
import {CreateTableCommand, BillingMode, KeyType, ScalarAttributeType} from '@aws-sdk/client-dynamodb'
import {CreateTopicCommand} from '@aws-sdk/client-sns'
import {CreateQueueCommand} from '@aws-sdk/client-sqs'
import {createLocalS3Client, createLocalDynamoDBClient, createLocalSNSClient, createLocalSQSClient} from './localstack-helpers.js'

/**
 * Setup LocalStack resources for integration testing
 */
async function setupLocalStackResources(): Promise<void> {
  console.log('Setting up LocalStack resources...')

  try {
    // Initialize clients
    const s3 = createLocalS3Client()
    const dynamodb = createLocalDynamoDBClient()
    const sns = createLocalSNSClient()
    const sqs = createLocalSQSClient()

    // Create S3 bucket
    console.log('Creating S3 bucket: lifegames-media-downloader-files')
    await s3.send(
      new CreateBucketCommand({
        Bucket: 'lifegames-media-downloader-files'
      })
    )

    // Create DynamoDB Files table
    console.log('Creating DynamoDB table: Files')
    await dynamodb.send(
      new CreateTableCommand({
        TableName: 'Files',
        KeySchema: [{AttributeName: 'id', KeyType: KeyType.HASH}],
        AttributeDefinitions: [{AttributeName: 'id', AttributeType: ScalarAttributeType.S}],
        BillingMode: BillingMode.PAY_PER_REQUEST
      })
    )

    // Create DynamoDB Users table
    console.log('Creating DynamoDB table: Users')
    await dynamodb.send(
      new CreateTableCommand({
        TableName: 'Users',
        KeySchema: [{AttributeName: 'id', KeyType: KeyType.HASH}],
        AttributeDefinitions: [{AttributeName: 'id', AttributeType: ScalarAttributeType.S}],
        BillingMode: BillingMode.PAY_PER_REQUEST
      })
    )

    // Create DynamoDB UserFiles table
    console.log('Creating DynamoDB table: UserFiles')
    await dynamodb.send(
      new CreateTableCommand({
        TableName: 'UserFiles',
        KeySchema: [
          {AttributeName: 'userId', KeyType: KeyType.HASH},
          {AttributeName: 'fileId', KeyType: KeyType.RANGE}
        ],
        AttributeDefinitions: [
          {AttributeName: 'userId', AttributeType: ScalarAttributeType.S},
          {AttributeName: 'fileId', AttributeType: ScalarAttributeType.S}
        ],
        BillingMode: BillingMode.PAY_PER_REQUEST
      })
    )

    // Create DynamoDB Devices table
    console.log('Creating DynamoDB table: Devices')
    await dynamodb.send(
      new CreateTableCommand({
        TableName: 'Devices',
        KeySchema: [{AttributeName: 'id', KeyType: KeyType.HASH}],
        AttributeDefinitions: [{AttributeName: 'id', AttributeType: ScalarAttributeType.S}],
        BillingMode: BillingMode.PAY_PER_REQUEST
      })
    )

    // Create SNS topic for push notifications
    console.log('Creating SNS topic: push-notifications')
    await sns.send(
      new CreateTopicCommand({
        Name: 'push-notifications'
      })
    )

    // Create SQS queue for SendPushNotification
    console.log('Creating SQS queue: SendPushNotificationQueue')
    await sqs.send(
      new CreateQueueCommand({
        QueueName: 'SendPushNotificationQueue'
      })
    )

    console.log('✅ LocalStack resources created successfully!')
  } catch (error) {
    console.error('❌ Error setting up LocalStack resources:', error)
    throw error
  }
}

// Run the setup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupLocalStackResources()
    .then(() => {
      console.log('Setup complete!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Setup failed:', error)
      process.exit(1)
    })
}

export {setupLocalStackResources}
