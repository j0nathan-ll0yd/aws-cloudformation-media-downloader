import {SQSMessageAttribute, SQSMessageAttributes} from 'aws-lambda'
import {Author, videoFormat} from 'ytdl-core'
import {Part} from 'aws-sdk/clients/s3'

interface Metadata {
  videoId: string
  fileName: string
  escapedTitle: string
  description: string
  formats: videoFormat[]
  mimeType: string
  ext: string
  imageUri?: string
  viewCount?: number
  timestamp?: number
  keywords?: string[]
  author: Author
  title: string
  published: number // time in milliseconds
}

interface StartFileUploadParams {
  fileId: string
}

interface UploadPartEvent {
  bucket: string
  bytesRemaining: number
  bytesTotal: number
  fileId: string
  key: string
  partBeg: number
  partEnd: number
  partNumber: number
  partSize: number
  partTags: Part[]
  uploadId: string
  url: string
}

interface CompleteFileUploadEvent {
  bucket: string
  bytesRemaining: number
  fileId: string
  key: string
  partTags: Part[]
  uploadId: string
}

interface UserFile {
  fileId: [string]
  userId: string
}

interface DeviceRegistration {
  name: string
  token: string
  systemVersion: string
  UUID: string
  systemName: string
}

interface UserDevice extends DeviceRegistration {
  endpointArn: string
}

interface DynamoDBFile {
  availableAt: number
  size: number
  authorName: string
  fileId: string
  publishDate: string
  description: string
  key: string
  url?: string // Won't exist on create
  contentType: string
  authorUser: string
  title: string
}

interface SignInWithAppleConfig {
  client_id: string
  team_id: string
  redirect_uri: string
  key_id: string
  scope: string
}

export class FileNotification implements SQSMessageAttributes {
  [name: string]: SQSMessageAttribute
  size: SQSMessageAttribute
  publishDate: SQSMessageAttribute
  key: SQSMessageAttribute
  url: SQSMessageAttribute
  userId: SQSMessageAttribute
}

// The shape of a file when send via push notification
interface ClientFile {
  key: string
  publishDate: string
  size: number
  url: string
}

interface UserRegistration {
  authorizationCode: string
  email: string
  firstName?: string
  lastName?: string
}

interface UserLogin {
  authorizationCode: string
}

interface UserSubscribe {
  endpoint: string
}

interface User {
  userId: string
  email: string
  emailVerified: boolean
  firstName: string
  lastName?: string
}

interface IdentityProvider {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresAt: number
}

interface IdentityProviderApple extends IdentityProvider {
  userId: string
  email: string
  emailVerified: boolean
  isPrivateEmail: boolean
}

// https://developer.apple.com/documentation/sign_in_with_apple/tokenresponse
interface AppleTokenResponse {
  access_token: string // A token used to access allowed data.
  expires_in: number // The amount of time, in seconds, before the access token expires.
  id_token: string // A JSON Web Token that contains the user’s identity information.
  refresh_token: string // The refresh token used to regenerate new access tokens.
  token_type: string // The type of access token. It will always be bearer.
}

interface ServerVerifiedToken {
  userId: string
}

interface SignInWithAppleVerifiedToken {
  iss: string // https://appleid.apple.com
  aud: string // lifegames.OfflineMediaDownloader
  exp: number // 1590096639
  iat: number // 1590096039
  sub: string // 000185.7720315570fc49d99a265f9af4b46879.2034
  at_hash: string // ztF31A59ZQ66PpC1D57ydg
  email: string // 28ncci33a3@privaterelay.appleid.com
  email_verified: boolean
  is_private_email: boolean
  auth_time: number
  nonce_supported: boolean
}
