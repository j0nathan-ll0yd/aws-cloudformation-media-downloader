declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ApnsSigningKey: string
      Bucket: string
      DefaultFileSize: string
      DefaultFileName: string
      DefaultFileUrl: string
      DefaultFileContentType: string
      DynamoDBTableDevices: string
      DynamoDBTableUsers: string
      DynamoDBTableFiles: string
      DynamoDBTableUserFiles: string
      DynamoDBTableUserDevices: string
      PlatformEncryptionKey: string
      GithubPersonalToken: string
      MultiAuthenticationPathParts: string
      ReservedClientIp: string
      SignInWithAppleConfig: string
      SignInWithAppleAuthKey: string
      SNSQueueUrl: string
      StateMachineArn: string
      PlatformApplicationArn: string
      PushNotificationTopicArn: string
      YtdlpBinaryPath: string
    }
  }
}

// Adding this export declaration file which Typescript/CRA can now pick up
export {}
