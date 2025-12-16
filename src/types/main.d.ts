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
  deviceId: string
}

/**
 * Permanent media file metadata.
 *
 * This contains ONLY permanent metadata about the media file.
 * Transient download state (retries, scheduling, errors) is in FileDownloads entity.
 *
 * Status values: 'pending' | 'available' | 'unavailable'
 */
interface DynamoDBFile {
  fileId: string
  size: number
  authorName: string
  authorUser: string
  publishDate: string
  description: string
  key: string
  url?: string
  contentType: string
  title: string
  status: FileStatus
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

// Push notification types for two-phase notification flow
export type FileNotificationType = 'MetadataNotification' | 'DownloadReadyNotification'

// Full metadata - sent when video info is first fetched (before download starts)
export interface MetadataNotification {
  fileId: string
  key: string
  title: string
  authorName: string
  authorUser: string
  description: string
  publishDate: string
  contentType: string
  status: 'pending'
}

// Minimal download info - sent when file is ready to download
export interface DownloadReadyNotification {
  fileId: string
  key: string
  size: number
  url: string
}

interface UserRegistration {
  idToken: string
  email: string
  firstName?: string
  lastName?: string
}

interface UserLogin {
  idToken: string
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
    authorizer: {integrationLatency: number; principalId: string}
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
