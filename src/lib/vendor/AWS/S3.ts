import {S3Client, HeadObjectCommand, HeadObjectCommandInput, HeadObjectCommandOutput} from '@aws-sdk/client-s3'

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
 * Get S3Client instance for Upload operations
 * @returns Configured S3Client instance
 */
export function getS3Client(): S3Client {
  return s3Client
}