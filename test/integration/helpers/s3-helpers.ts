/**
 * S3 Test Helpers
 *
 * Utilities for creating buckets and verifying S3 uploads in LocalStack
 */

import {createBucket, deleteBucket, listObjectsV2, deleteObject as deleteS3Object, headObject, getObject} from '../lib/vendor/AWS/S3'
import {Readable} from 'stream'

/**
 * Create a test bucket in LocalStack S3
 */
export async function createTestBucket(bucketName: string): Promise<void> {
  try {
    await createBucket(bucketName)
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
    const listResponse = await listObjectsV2(bucketName)

    if (listResponse.Contents && listResponse.Contents.length > 0) {
      await Promise.all(listResponse.Contents.map((object) => deleteS3Object(bucketName, object.Key!)))
    }

    // Then delete the bucket
    await deleteBucket(bucketName)
  } catch {
    // Bucket might not exist
  }
}

/**
 * Check if an object exists in S3
 */
export async function objectExists(bucketName: string, key: string): Promise<boolean> {
  try {
    await headObject(bucketName, key)
    return true
  } catch {
    return false
  }
}

/**
 * Get object metadata from S3
 */
export async function getObjectMetadata(bucketName: string, key: string): Promise<{contentLength: number; contentType: string} | null> {
  try {
    const response = await headObject(bucketName, key)

    return {
      contentLength: response.ContentLength || 0,
      contentType: response.ContentType || 'application/octet-stream'
    }
  } catch {
    return null
  }
}

/**
 * Get object content from S3 as buffer
 */
export async function getObjectContent(bucketName: string, key: string): Promise<Buffer | null> {
  try {
    const response = await getObject(bucketName, key)

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
  } catch {
    return null
  }
}

/**
 * Delete an object from S3
 */
export async function deleteObject(bucketName: string, key: string): Promise<void> {
  try {
    await deleteS3Object(bucketName, key)
  } catch {
    // Object might not exist
  }
}

/**
 * List all objects in a bucket
 */
export async function listObjects(bucketName: string): Promise<string[]> {
  const response = await listObjectsV2(bucketName)

  if (!response.Contents) {
    return []
  }

  return response.Contents.map((object) => object.Key!).filter(Boolean)
}
