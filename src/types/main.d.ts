import {SQSMessageAttribute, SQSMessageAttributes} from 'aws-lambda'
import {Author, videoFormat} from 'ytdl-core'
import {CloudFrontCustomOrigin, CloudFrontRequest} from 'aws-lambda/common/cloudfront'
import {FileStatus, UserStatus} from './enums'
import {
  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventMultiValueHeaders,
  APIGatewayProxyEventMultiValueQueryStringParameters,
  APIGatewayProxyEventPathParameters,
  APIGatewayProxyEventQueryStringParameters,
  APIGatewayProxyEventStageVariables
} from 'aws-lambda/trigger/api-gateway-proxy'
import {APIGatewayEventIdentity} from 'aws-lambda/common/api-gateway'
import {JWTPayload} from 'jose'

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

interface ApplePushNotificationResponse {
  statusCode: number
  reason?: string
}

interface UserFile {
  fileId: [string]
  userId: string
}

interface DeviceRegistrationRequest {
  name: string
  token: string
  systemVersion: string
  deviceId: string
  systemName: string
}

interface Device extends DeviceRegistrationRequest {
  endpointArn: string
}

interface DynamoDBUserDevice {
  userId: string
  devices: Set<string>
}

interface DynamoDBFile {
  [key: string]: string | number | undefined
  availableAt: number
  size: number
  authorName: string
  fileId: string
  publishDate: string
  description: string
  key: string
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  url?: string // Won't exist on create
  contentType: string
  authorUser: string
  title: string
  status: FileStatus
  retryAfter?: number
  retryCount?: number
  maxRetries?: number
  lastError?: string
  scheduledPublishTime?: number
}

interface SignInWithAppleConfig {
  client_id: string
  team_id: string
  redirect_uri: string
  key_id: string
  scope: string
}

interface UserEventDetails {
  userId?: string
  userStatus: UserStatus
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
  fileId: string
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
  endpointArn: string
  topicArn: string
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

interface ServerVerifiedToken extends JWTPayload {
  userId: string
}

interface SignInWithAppleVerifiedToken extends JWTPayload {
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

// Types specifically for Cloudfront
type CustomCloudFrontOrigin = {custom: CloudFrontCustomOrigin}
interface CustomCloudFrontRequest extends CloudFrontRequest {
  clientIp: string
  origin: CustomCloudFrontOrigin
}

// TODO: This has to be a custom event, because the actual event does NOT contain the requestContext.identity.clientCert field
interface CustomAPIGatewayRequestAuthorizerEvent {
  requestContext: {
    accountId: string
    apiId: string
    // This one is a bit confusing: it is not actually present in authorizer calls
    // and proxy calls without an authorizer. We model this by allowing undefined in the type,
    // since it ends up the same and avoids breaking users that are testing the property.
    // This lets us allow parameterizing the authorizer for proxy events that know what authorizer
    // context values they have.
    authorizer: {
      integrationLatency: number
      principalId: string
    }
    connectedAt?: number | undefined
    connectionId?: string | undefined
    domainName?: string | undefined
    domainPrefix?: string | undefined
    eventType?: string | undefined
    extendedRequestId?: string | undefined
    protocol: string
    httpMethod: string
    identity: Omit<APIGatewayEventIdentity, 'clientCert'>
    messageDirection?: string | undefined
    messageId?: string | null | undefined
    path: string
    stage: string
    requestId: string
    requestTime?: string | undefined
    requestTimeEpoch: number
    resourceId: string
    resourcePath: string
    routeKey?: string | undefined
  }
  body: string | null
  headers: APIGatewayProxyEventHeaders
  multiValueHeaders: APIGatewayProxyEventMultiValueHeaders
  httpMethod: string
  isBase64Encoded: boolean
  path: string
  pathParameters: APIGatewayProxyEventPathParameters | null
  queryStringParameters: APIGatewayProxyEventQueryStringParameters | null
  multiValueQueryStringParameters: APIGatewayProxyEventMultiValueQueryStringParameters | null
  stageVariables: APIGatewayProxyEventStageVariables | null
  resource: string
}
