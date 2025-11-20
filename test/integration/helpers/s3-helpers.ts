/**
 * S3 Test Helpers
 *
 * Utilities for creating buckets and verifying S3 uploads in LocalStack
 */

import {createS3Client} from '../../../src/lib/vendor/AWS/clients'
import {
  CreateBucketCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
  GetObjectCommand
} from '@aws-sdk/client-s3'
import {Readable} from 'stream'

const s3Client = createS3Client()

/**
 * Create a test bucket in LocalStack S3
 */
export async function createTestBucket(bucketName: string): Promise<void> {
  try {
    await s3Client.send(new CreateBucketCommand({Bucket: bucketName}))
  } catch (error) {
    // Bucket might already exist
    if (!(error instanceof Error && error.name === 'BucketAlreadyOwnedByYou')) {
      throw error
    }
  }
}

/**
 * Delete a test bucket and all its contents from LocalStack S3
 */
export async function deleteTestBucket(bucketName: string): Promise<void> {
  try {
    // First, delete all objects in the bucket
    const listResponse = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucketName
      })
    )

    if (listResponse.Contents && listResponse.Contents.length > 0) {
      await Promise.all(
        listResponse.Contents.map((object) =>
          s3Client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: object.Key!
            })
          )
        )
      )
    }

    // Then delete the bucket
    await s3Client.send(new DeleteBucketCommand({Bucket: bucketName}))
  } catch (error) {
    // Bucket might not exist
  }
}

/**
 * Check if an object exists in S3
 */
export async function objectExists(bucketName: string, key: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: key
      })
    )
    return true
  } catch (error) {
    return false
  }
}

/**
 * Get object metadata from S3
 */
export async function getObjectMetadata(
  bucketName: string,
  key: string
): Promise<{contentLength: number; contentType: string} | null> {
  try {
    const response = await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: key
      })
    )

    return {
      contentLength: response.ContentLength || 0,
      contentType: response.ContentType || 'application/octet-stream'
    }
  } catch (error) {
    return null
  }
}

/**
 * Get object content from S3 as buffer
 */
export async function getObjectContent(bucketName: string, key: string): Promise<Buffer | null> {
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key
      })
    )

    if (!response.Body) {
      return null
    }

    // Convert stream to buffer
    const chunks: Buffer[] = []
    const stream = response.Body as Readable

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      stream.on('error', reject)
      stream.on('end', () => resolve(Buffer.concat(chunks)))
    })
  } catch (error) {
    return null
  }
}

/**
 * Delete an object from S3
 */
export async function deleteObject(bucketName: string, key: string): Promise<void> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key
      })
    )
  } catch (error) {
    // Object might not exist
  }
}

/**
 * List all objects in a bucket
 */
export async function listObjects(bucketName: string): Promise<string[]> {
  const response = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: bucketName
    })
  )

  if (!response.Contents) {
    return []
  }

  return response.Contents.map((object) => object.Key!).filter(Boolean)
}
