declare global {
  namespace NodeJS {
    interface ProcessEnv {
      APPLE_BUNDLE_ID: string
      APPLE_CLIENT_ID: string
      ApnsDefaultTopic: string
      ApnsKeyId: string
      ApnsSigningKey: string
      ApnsTeam: string
      BASE_URL: string
      Bucket: string
      DefaultFileSize: string
      DefaultFileName: string
      DefaultFileUrl: string
      DefaultFileContentType: string
      DynamoDBTableName: string
      GithubPersonalToken: string
      MultiAuthenticationPathParts: string
      PlatformApplicationArn: string
      PushNotificationTopicArn: string
      ReservedClientIp: string
      SignInWithAppleConfig: string
      SNSQueueUrl: string
      StateMachineArn: string
      YtdlpBinaryPath: string
    }
  }
}

// Adding this export declaration file which Typescript/CRA can now pick up
export {}
