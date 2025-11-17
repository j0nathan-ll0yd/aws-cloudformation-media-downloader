import {S3Client, HeadObjectCommand, HeadObjectCommandInput, HeadObjectCommandOutput} from '@aws-sdk/client-s3'
import {Upload, Options as UploadOptions} from '@aws-sdk/lib-storage'
import {Readable} from 'stream'

const s3Client = new S3Client({region: process.env.AWS_REGION || 'us-west-2'})

/**
 * Get metadata for an S3 object
 * @param bucket - S3 bucket name
 * @param key - S3 object key
 * @returns Object metadata including ContentLength
 */
export async function headObject(bucket: string, key: string): Promise<HeadObjectCommandOutput> {
  const params: HeadObjectCommandInput = {
    Bucket: bucket,
    Key: key
  }
  const command = new HeadObjectCommand(params)
  return s3Client.send(command)
}

/**
 * Create a multipart upload stream to S3
 * @param bucket - S3 bucket name
 * @param key - S3 object key
 * @param body - Stream or buffer to upload
 * @param contentType - Content type of the object (defaults to 'video/mp4')
 * @param options - Optional upload configuration
 * @returns Upload instance for streaming data to S3
 */
export function createS3Upload(bucket: string, key: string, body: Readable | Buffer, contentType: string = 'video/mp4', options?: Partial<UploadOptions>): Upload {
  return new Upload({
    client: s3Client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType
    },
    queueSize: options?.queueSize || 4,
    partSize: options?.partSize || 5 * 1024 * 1024, // 5MB default
    ...options
  })
}
