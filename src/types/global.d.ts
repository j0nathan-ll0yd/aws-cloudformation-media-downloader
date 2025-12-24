/**
 * Global Type Declarations
 *
 * Extends NodeJS.ProcessEnv with Lambda environment variables.
 * All variables are required at runtime and validated by getRequiredEnv().
 *
 * @see getRequiredEnv() in src/lib/system/env.ts for runtime validation
 * @see terraform/*.tf for environment variable configuration
 */

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // APNS (Apple Push Notification Service) Configuration
      /** Bundle ID for APNS topic (e.g., 'com.example.app') */
      ApnsDefaultTopic: string
      /** Key ID from Apple Developer portal for APNS authentication */
      ApnsKeyId: string
      /** P8 private key content for signing APNS requests (base64 encoded) */
      ApnsSigningKey: string
      /** Team ID from Apple Developer account */
      ApnsTeam: string

      // Application Configuration
      /** Base URL for the application (e.g., 'https://api.example.com') */
      ApplicationUrl: string

      // S3 Storage Configuration
      /** S3 bucket name for media file storage */
      Bucket: string

      // Default File Configuration (for anonymous/demo users)
      /** Default demo file size in bytes */
      DefaultFileSize: string
      /** Default demo file name for anonymous users */
      DefaultFileName: string
      /** CloudFront URL to default demo file */
      DefaultFileUrl: string
      /** MIME type of default file (e.g., 'video/mp4') */
      DefaultFileContentType: string

      // DynamoDB Configuration
      /** DynamoDB table name for single-table design */
      DynamoDBTableName: string

      // GitHub Integration
      /** Personal access token for creating GitHub issues on errors */
      GithubPersonalToken: string

      // Authentication Configuration
      /** Comma-separated path parts that allow multiple auth methods */
      MultiAuthenticationPathParts: string

      // SNS Configuration
      /** ARN of SNS platform application for iOS push notifications */
      PlatformApplicationArn: string
      /** ARN of SNS topic for push notifications */
      PushNotificationTopicArn: string
      /** SQS queue URL for push notification messages */
      SNSQueueUrl: string

      // Security Configuration
      /** Reserved IP for internal/testing requests */
      ReservedClientIp: string
      /** JSON config for Sign In With Apple authentication */
      SignInWithAppleConfig: string

      // Step Functions
      /** ARN of Step Functions state machine (if used) */
      StateMachineArn: string

      // External Tools
      /** Path to yt-dlp binary for YouTube downloads */
      YtdlpBinaryPath: string
    }
  }
}

// Required to make this a module
export {}
