/**
 * @fixture invalid
 * @rule aws-sdk-encapsulation
 * @severity CRITICAL
 * @description Direct S3 SDK import with multiple exports (forbidden)
 * @expectedViolations 1
 */
import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3'

const client = new S3Client({})
export {client, PutObjectCommand}
