/**
 * S3 Test Helpers
 *
 * Utilities for creating buckets and verifying S3 uploads in LocalStack
 */

import {createBucket, deleteBucket, deleteObject as deleteS3Object, listObjectsV2} from '../lib/vendor/AWS/S3'

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
