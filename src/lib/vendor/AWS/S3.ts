import {HeadObjectCommand} from '@aws-sdk/client-s3'
import type {HeadObjectCommandInput, HeadObjectCommandOutput} from '@aws-sdk/client-s3'
import {Upload} from '@aws-sdk/lib-storage'
import type {Options as UploadOptions} from '@aws-sdk/lib-storage'
import {Readable} from 'stream'
import {createS3Client} from './clients'

const s3Client = createS3Client()

/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export async function headObject(bucket: string, key: string): Promise<HeadObjectCommandOutput> {
  const params: HeadObjectCommandInput = {Bucket: bucket, Key: key}
  const command = new HeadObjectCommand(params)
  return s3Client.send(command)
}
/* c8 ignore stop */

/* c8 ignore start - Thin wrapper with default parameters, tested via integration tests */
export function createS3Upload(
  bucket: string,
  key: string,
  body: Readable | Buffer,
  contentType: string = 'video/mp4',
  options?: Partial<UploadOptions>
): Upload {
  return new Upload({
    client: s3Client,
    params: {Bucket: bucket, Key: key, Body: body, ContentType: contentType},
    queueSize: options?.queueSize || 4,
    partSize: options?.partSize || 5 * 1024 * 1024, // 5MB default
    ...options
  })
}
/* c8 ignore stop */
