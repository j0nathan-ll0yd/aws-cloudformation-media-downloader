/**
 * S3 Vendor Wrapper
 *
 * Encapsulates AWS S3 SDK operations with declarative permission metadata.
 * Each method declares the AWS permissions it requires via decorators.
 * Permissions are extracted at build time to generate Lambda IAM policies.
 *
 * @see src/lib/vendor/AWS/clients.ts for client factory
 * @see src/lib/vendor/AWS/decorators.ts for permission decorators
 */
import {HeadObjectCommand} from '@aws-sdk/client-s3'
import type {HeadObjectCommandInput, HeadObjectCommandOutput} from '@aws-sdk/client-s3'
import {Upload} from '@aws-sdk/lib-storage'
import type {Options as UploadOptions} from '@aws-sdk/lib-storage'
import type {Readable} from 'stream'
import {createS3Client} from './clients'
import {RequiresS3} from './decorators'
import {S3Resource} from '#types/generatedResources'
import {S3Operation} from '#types/servicePermissions'

const s3Client = createS3Client()

/**
 * S3 vendor wrapper with declarative permission metadata.
 * Each method declares the AWS permissions it requires via decorators.
 * Permissions are extracted at build time to generate Lambda IAM policies.
 */
/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
class S3Vendor {
  @RequiresS3(`${S3Resource.Files}/*`, [S3Operation.HeadObject])
  static async headObject(bucket: string, key: string): Promise<HeadObjectCommandOutput> {
    const params: HeadObjectCommandInput = {Bucket: bucket, Key: key}
    const command = new HeadObjectCommand(params)
    return s3Client.send(command)
  }

  /**
   * Creates an S3 multipart upload for streaming large files.
   * Uses the aws-sdk lib-storage Upload class for automatic chunking.
   *
   * Permissions required:
   * - PutObject: Initial upload and completing the upload
   * - AbortMultipartUpload: Cancel incomplete uploads
   * - ListMultipartUploadParts: Resume interrupted uploads
   */
  @RequiresS3(`${S3Resource.Files}/*`, [S3Operation.PutObject, S3Operation.AbortMultipartUpload, S3Operation.ListMultipartUploadParts])
  static createS3Upload(bucket: string, key: string, body: Readable | Buffer, contentType: string = 'video/mp4', options?: Partial<UploadOptions>): Upload {
    return new Upload({
      client: s3Client,
      params: {Bucket: bucket, Key: key, Body: body, ContentType: contentType},
      queueSize: options?.queueSize || 4,
      partSize: options?.partSize || 5 * 1024 * 1024, // 5MB default
      ...options
    })
  }
}
/* c8 ignore stop */

// Export static methods for backwards compatibility with existing imports
export const headObject = S3Vendor.headObject.bind(S3Vendor)
export const createS3Upload = S3Vendor.createS3Upload.bind(S3Vendor)

// Export class for extraction script access
export { S3Vendor }
