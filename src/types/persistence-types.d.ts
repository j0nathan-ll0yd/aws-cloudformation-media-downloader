/**
 * Persistence/relationship types for DynamoDB join tables
 */

export interface UserDevice {
  userId: string
  deviceId: string
}

export interface UserFile {
  fileId: string
  userId: string
}
