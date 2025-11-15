/**
 * Integration tests for S3 operations using LocalStack
 *
 * These tests verify S3 functionality against a local AWS emulator
 */

import {describe, expect, test, beforeAll} from '@jest/globals'
import {PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand} from '@aws-sdk/client-s3'
import {createLocalS3Client} from '../../../util/localstack-helpers.js'

describe('S3 Operations (LocalStack Integration)', () => {
  let s3Client: ReturnType<typeof createLocalS3Client>
  const testBucket = 'lifegames-media-downloader-files'

  beforeAll(() => {
    s3Client = createLocalS3Client()
  })

  test('should upload a file to S3', async () => {
    const testKey = 'test-file.txt'
    const testContent = 'Hello from LocalStack integration test!'

    // Upload file
    await s3Client.send(
      new PutObjectCommand({
        Bucket: testBucket,
        Key: testKey,
        Body: testContent,
        ContentType: 'text/plain'
      })
    )

    // Verify file was uploaded
    const getResult = await s3Client.send(
      new GetObjectCommand({
        Bucket: testBucket,
        Key: testKey
      })
    )

    expect(getResult.ContentType).toBe('text/plain')
    const body = await getResult.Body?.transformToString()
    expect(body).toBe(testContent)

    // Cleanup
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: testBucket,
        Key: testKey
      })
    )
  })

  test('should list objects in S3 bucket', async () => {
    // Upload test files
    const testKeys = ['test-1.txt', 'test-2.txt', 'test-3.txt']
    for (const key of testKeys) {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: testBucket,
          Key: key,
          Body: `Content of ${key}`
        })
      )
    }

    // List objects
    const listResult = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: testBucket
      })
    )

    expect(listResult.Contents).toBeDefined()
    expect(listResult.Contents!.length).toBeGreaterThanOrEqual(testKeys.length)

    // Verify our test files are in the list
    const listedKeys = listResult.Contents!.map((obj) => obj.Key)
    for (const key of testKeys) {
      expect(listedKeys).toContain(key)
    }

    // Cleanup
    for (const key of testKeys) {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: testBucket,
          Key: key
        })
      )
    }
  })

  test('should handle non-existent object gracefully', async () => {
    const nonExistentKey = 'this-does-not-exist.txt'

    await expect(
      s3Client.send(
        new GetObjectCommand({
          Bucket: testBucket,
          Key: nonExistentKey
        })
      )
    ).rejects.toThrow()
  })

  test('should delete an object from S3', async () => {
    const testKey = 'file-to-delete.txt'

    // Upload file
    await s3Client.send(
      new PutObjectCommand({
        Bucket: testBucket,
        Key: testKey,
        Body: 'This file will be deleted'
      })
    )

    // Delete file
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: testBucket,
        Key: testKey
      })
    )

    // Verify file was deleted
    await expect(
      s3Client.send(
        new GetObjectCommand({
          Bucket: testBucket,
          Key: testKey
        })
      )
    ).rejects.toThrow()
  })
})
