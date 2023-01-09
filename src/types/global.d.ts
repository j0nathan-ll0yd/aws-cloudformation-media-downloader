declare global {
  namespace NodeJS {
    interface ProcessEnv {
      Bucket: string
      DefaultFileSize: string
      DefaultFileName: string
      DefaultFileUrl: string
      DefaultFileContentType: string
      DynamoDBTableUsers: string
      DynamoDBTableFiles: string
      DynamoDBTableUserFiles: string
      DynamoDBTableUserDevices: string
      EncryptionKeySecretId: string
      SNSQueueUrl: string
      StateMachineArn: string
      PlatformApplicationArn: string
      PushNotificationTopicArn: string
    }
  }
}

// Adding this export declaration file which Typescript/CRA can now pick up
export {}