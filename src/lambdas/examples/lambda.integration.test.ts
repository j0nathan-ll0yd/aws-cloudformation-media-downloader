/**
 * Example integration test for a Lambda function using LocalStack
 * 
 * This file demonstrates how to write integration tests for Lambda functions
 * that interact with real AWS services (S3, DynamoDB, etc.) running in LocalStack.
 * 
 * To run this test:
 *   npm run test:integration
 * 
 * Or manually:
 *   npm run localstack:start
 *   npm run localstack:setup
 *   npm run test:integration:run
 *   npm run localstack:stop
 */

import {describe, expect, test, beforeAll, afterEach} from '@jest/globals'
import {PutCommand, GetCommand, DeleteCommand} from '@aws-sdk/lib-dynamodb'
import {PutObjectCommand, GetObjectCommand, DeleteObjectCommand} from '@aws-sdk/client-s3'
import {DynamoDBDocument} from '@aws-sdk/lib-dynamodb'
import {createLocalS3Client, createLocalDynamoDBClient} from '../../util/localstack-helpers'
import {randomUUID} from 'crypto'

/**
 * Example: Testing a Lambda function that coordinates file upload workflow
 * 
 * This test demonstrates:
 * 1. Creating initial state in DynamoDB
 * 2. Uploading a file to S3
 * 3. Verifying the Lambda would process correctly
 * 4. Cleaning up test resources
 */
describe('Lambda Integration Test Example', () => {
  let s3Client: ReturnType<typeof createLocalS3Client>
  let docClient: DynamoDBDocument
  const testBucket = 'lifegames-media-downloader-files'
  const testTable = 'Files'
  const createdIds: string[] = []

  beforeAll(() => {
    s3Client = createLocalS3Client()
    const dynamoClient = createLocalDynamoDBClient()
    docClient = DynamoDBDocument.from(dynamoClient)
  })

  afterEach(async () => {
    // Cleanup: Delete all test items from DynamoDB
    for (const id of createdIds) {
      try {
        await docClient.send(
          new DeleteCommand({
            TableName: testTable,
            Key: {id}
          })
        )
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    createdIds.length = 0
  })

  test('should simulate file upload workflow', async () => {
    const fileId = randomUUID()
    createdIds.push(fileId)
    const s3Key = `${fileId}.mp4`

    // Step 1: Create initial file record in DynamoDB (what StartFileUpload does)
    const fileRecord = {
      id: fileId,
      title: 'Integration Test Video',
      url: 'https://www.youtube.com/watch?v=test123',
      status: 'Pending',
      createdAt: new Date().toISOString()
    }

    await docClient.send(
      new PutCommand({
        TableName: testTable,
        Item: fileRecord
      })
    )

    // Step 2: Upload file to S3 (simulating video download)
    const testVideoContent = Buffer.from('Mock video content for testing')
    await s3Client.send(
      new PutObjectCommand({
        Bucket: testBucket,
        Key: s3Key,
        Body: testVideoContent,
        ContentType: 'video/mp4'
      })
    )

    // Step 3: Update file status to "Downloaded" (what CompleteFileUpload does)
    await docClient.send(
      new PutCommand({
        TableName: testTable,
        Item: {
          ...fileRecord,
          status: 'Downloaded',
          size: testVideoContent.length,
          s3Key: s3Key,
          completedAt: new Date().toISOString()
        }
      })
    )

    // Step 4: Verify the workflow completed correctly
    const dbResult = await docClient.send(
      new GetCommand({
        TableName: testTable,
        Key: {id: fileId}
      })
    )

    expect(dbResult.Item).toBeDefined()
    expect(dbResult.Item!.status).toBe('Downloaded')
    expect(dbResult.Item!.size).toBe(testVideoContent.length)
    expect(dbResult.Item!.s3Key).toBe(s3Key)

    // Verify file exists in S3
    const s3Result = await s3Client.send(
      new GetObjectCommand({
        Bucket: testBucket,
        Key: s3Key
      })
    )

    expect(s3Result.ContentType).toBe('video/mp4')
    expect(s3Result.ContentLength).toBe(testVideoContent.length)

    // Cleanup S3
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: testBucket,
        Key: s3Key
      })
    )
  })

  test('should handle file upload failure scenario', async () => {
    const fileId = randomUUID()
    createdIds.push(fileId)

    // Create initial record
    await docClient.send(
      new PutCommand({
        TableName: testTable,
        Item: {
          id: fileId,
          title: 'Test Video That Will Fail',
          url: 'https://www.youtube.com/watch?v=invalid',
          status: 'Pending',
          createdAt: new Date().toISOString()
        }
      })
    )

    // Simulate failure by updating status to Error
    const errorMessage = 'Video not available'
    await docClient.send(
      new PutCommand({
        TableName: testTable,
        Item: {
          id: fileId,
          title: 'Test Video That Will Fail',
          url: 'https://www.youtube.com/watch?v=invalid',
          status: 'Error',
          error: errorMessage,
          createdAt: new Date().toISOString()
        }
      })
    )

    // Verify error state
    const result = await docClient.send(
      new GetCommand({
        TableName: testTable,
        Key: {id: fileId}
      })
    )

    expect(result.Item).toBeDefined()
    expect(result.Item!.status).toBe('Error')
    expect(result.Item!.error).toBe(errorMessage)
  })

  test('should verify file metadata is correctly stored', async () => {
    const fileId = randomUUID()
    createdIds.push(fileId)

    const metadata = {
      id: fileId,
      title: 'Test Video with Metadata',
      url: 'https://www.youtube.com/watch?v=metadata123',
      status: 'Downloaded',
      duration: 180, // 3 minutes
      format: 'mp4',
      resolution: '1080p',
      size: 10485760, // 10 MB
      thumbnail: 'https://example.com/thumb.jpg',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    }

    await docClient.send(
      new PutCommand({
        TableName: testTable,
        Item: metadata
      })
    )

    const result = await docClient.send(
      new GetCommand({
        TableName: testTable,
        Key: {id: fileId}
      })
    )

    expect(result.Item).toBeDefined()
    expect(result.Item!.duration).toBe(180)
    expect(result.Item!.format).toBe('mp4')
    expect(result.Item!.resolution).toBe('1080p')
    expect(result.Item!.thumbnail).toBe('https://example.com/thumb.jpg')
  })
})
