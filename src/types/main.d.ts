import {S3} from 'aws-sdk'
import {Author, videoFormat} from 'ytdl-core'
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
  videoId: string,
  fileName: string,
  escapedTitle: string,
  description: string,
  formats: videoFormat[]
  mimeType: string,
  ext: string,
  imageUri?: string,
  viewCount?: number,
  timestamp?: number,
  keywords?: string[]
  author: Author,
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

interface UserRegistration {
  authorizationCode: string,
  email: string,
  firstName?: string,
  lastName?: string
}

interface UserLogin {
  authorizationCode: string
}

interface UserSubscribe {
  endpoint: string
}

interface User {
  userId: string,
  email: string,
  emailVerified: boolean,
  firstName: string,
  lastName?: string,
}

interface IdentityProvider {
  accessToken: string,
  refreshToken: string,
  tokenType: string,
  expiresAt: number
}

interface IdentityProviderApple extends IdentityProvider {
  userId: string,
  email: string,
  emailVerified: boolean,
  isPrivateEmail: boolean
}

// https://developer.apple.com/documentation/sign_in_with_apple/tokenresponse
interface AppleTokenResponse {
  access_token: string, // A token used to access allowed data.
  expires_in: number, // The amount of time, in seconds, before the access token expires.
  id_token: string, // A JSON Web Token that contains the user’s identity information.
  refresh_token: string, // The refresh token used to regenerate new access tokens.
  token_type: string // The type of access token. It will always be bearer.
}
