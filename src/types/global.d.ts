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
      EncryptionKeySecretId: string
      GithubPersonalToken: string
      MultiAuthenticationPathParts: string
      ReservedClientIp: string
      SNSQueueUrl: string
      StateMachineArn: string
      PlatformApplicationArn: string
      PushNotificationTopicArn: string
      YouTubeDownloaderLambdaArn: string
    }
  }
}

// Adding this export declaration file which Typescript/CRA can now pick up
export {}
