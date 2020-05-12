import {S3} from 'aws-sdk'
import {videoFormat} from 'ytdl-core'
import {Part} from '../../node_modules/aws-sdk/clients/s3'
import {AmazonSNSEvent, Record, Sns} from './vendor/Amazon/SNS/Event'

interface SomeSns extends Sns {
  Message: string
}

interface SomeRecord extends Record {
  Sns: SomeSns
}

interface UploadFileEvent extends AmazonSNSEvent {
  Records: [SomeRecord]
}

interface Metadata {
  description: string,
  formats: videoFormat[]
  mimeType: string,
  ext: string,
  imageUri?: string,
  viewCount?: number,
  timestamp?: number,
  keywords?: string[]
  author: {
      id: string;
      name: string;
      avatar: string;
      user: string;
      channel_url: string;
      user_url: string;
  },
  title: string,
  published: number // time in milliseconds
}


interface UploadPartEvent {
  bucket: string
  bytesRemaining: number,
  bytesTotal: number,
  fileId: string,
  key: string,
  partBeg: number,
  partEnd: number,
  partNumber: number,
  partSize: number,
  partTags: Part[],
  uploadId: string,
  url: string
}

interface CompleteFileUploadEvent {
  bucket: string
  bytesRemaining: number,
  fileId: string,
  key: string,
  partTags: Part[],
  uploadId: string
}

interface StartFileUploadEvent {
  bucket: string,
  bytesTotal: number,
  contentType: string,
  fileId: string,
  key: string,
  metadata?: object,
  url: string
}

interface ExtendedS3Object extends S3.Object {
  FileUrl: string
}

interface DeviceRegistration {
  name: string,
  token: string,
  systemVersion: string,
  UUID: string,
  systemName: string
}
