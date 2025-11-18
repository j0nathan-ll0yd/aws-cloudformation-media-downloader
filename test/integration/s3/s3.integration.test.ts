/**
 * S3 Integration Tests
 *
 * Tests S3 vendor wrapper functions against LocalStack to verify:
 * - Object upload using createS3Upload
 * - Object metadata retrieval using headObject
 * - Real AWS SDK interactions without mocking
 */

import {describe, test, expect, beforeAll, afterAll, afterEach} from '@jest/globals'
import {headObject, createS3Upload} from '../../../src/lib/vendor/AWS/S3'
import {createS3Client} from '../../../src/lib/vendor/AWS/clients'
import {CreateBucketCommand, DeleteObjectCommand, DeleteBucketCommand} from '@aws-sdk/client-s3'

const TEST_BUCKET = 'test-integration-bucket'
const TEST_KEY = 'test-object.txt'

describe('S3 Integration Tests', () => {
  let s3Client: ReturnType<typeof createS3Client>

  beforeAll(async () => {
    // Create S3 client for test setup/teardown
    s3Client = createS3Client()

    // Create test bucket in LocalStack
    try {
      await s3Client.send(new CreateBucketCommand({Bucket: TEST_BUCKET}))
    } catch (error) {
      // Bucket might already exist from previous test run
      console.log('Test bucket already exists or creation failed:', error)
    }
  })

  afterAll(async () => {
    // Clean up test bucket
    try {
      // Delete all objects first
      await s3Client.send(new DeleteObjectCommand({Bucket: TEST_BUCKET, Key: TEST_KEY}))
      // Then delete bucket
      await s3Client.send(new DeleteBucketCommand({Bucket: TEST_BUCKET}))
    } catch (error) {
      console.log('Cleanup failed:', error)
    }
  })

  afterEach(async () => {
    // Clean up test object after each test
    try {
      await s3Client.send(new DeleteObjectCommand({Bucket: TEST_BUCKET, Key: TEST_KEY}))
    } catch (error) {
      // Object might not exist
    }
  })

  test('should upload object to S3 using createS3Upload', async () => {
    // Arrange
    const testContent = Buffer.from('integration test content')

    // Act
    const upload = createS3Upload(TEST_BUCKET, TEST_KEY, testContent, 'text/plain')
    const result = await upload.done()

    // Assert
    expect(result).toBeDefined()
    expect(result.Location).toContain(TEST_BUCKET)
    expect(result.Key).toBe(TEST_KEY)
  })

  test('should retrieve object metadata using headObject', async () => {
    // Arrange - upload test object first
    const testContent = Buffer.from('test metadata content')
    const upload = createS3Upload(TEST_BUCKET, TEST_KEY, testContent, 'text/plain')
    await upload.done()

    // Act
    const metadata = await headObject(TEST_BUCKET, TEST_KEY)

    // Assert
    expect(metadata).toBeDefined()
    expect(metadata.ContentLength).toBe(testContent.length)
    expect(metadata.ContentType).toBe('text/plain')
  })

  test('should handle large file upload with streaming', async () => {
    // Arrange - create 10MB buffer
    const largeContent = Buffer.alloc(10 * 1024 * 1024, 'a')

    // Act
    const upload = createS3Upload(TEST_BUCKET, TEST_KEY, largeContent, 'application/octet-stream', {
      partSize: 5 * 1024 * 1024, // 5MB parts
      queueSize: 4
    })
    const result = await upload.done()

    // Assert
    expect(result).toBeDefined()

    // Verify uploaded size
    const metadata = await headObject(TEST_BUCKET, TEST_KEY)
    expect(metadata.ContentLength).toBe(largeContent.length)
  })

  test('should throw error when bucket does not exist', async () => {
    // Arrange
    const nonExistentBucket = 'non-existent-bucket'

    // Act & Assert
    await expect(headObject(nonExistentBucket, TEST_KEY)).rejects.toThrow()
  })

  test('should throw error when object does not exist', async () => {
    // Arrange
    const nonExistentKey = 'non-existent-key.txt'

    // Act & Assert
    await expect(headObject(TEST_BUCKET, nonExistentKey)).rejects.toThrow()
  })
})
