import {Service} from 'electrodb'
import {DynamoDBDocument} from '@aws-sdk/lib-dynamodb'
import {createDynamoDBClient} from '../AWS/clients'

// Import all entities
import {Files} from './entities/Files'
import {Users} from './entities/Users'
import {Devices} from './entities/Devices'
import {UserFiles} from './entities/UserFiles'
import {UserDevices} from './entities/UserDevices'

// Re-export entities
export {Files} from './entities/Files'
export {Users} from './entities/Users'
export {Devices} from './entities/Devices'
export {UserFiles} from './entities/UserFiles'
export {UserDevices} from './entities/UserDevices'

// Create DynamoDB Document client
const dynamoDBClient = createDynamoDBClient()
const documentClient = DynamoDBDocument.from(dynamoDBClient)

/**
 * MediaDownloader Service
 *
 * This service combines all entities for the media downloader application.
 * It provides collections for JOIN-like operations between related entities.
 */
export const MediaDownloaderService = new Service(
  {
    files: Files,
    users: Users,
    devices: Devices,
    userFiles: UserFiles,
    userDevices: UserDevices
  },
  {
    client: documentClient as any, // ElectroDB accepts the document client
    table: process.env.DynamoDBTableName || 'MediaDownloader' // Default table name
  }
)

// Export the service for use in Lambda functions
export default MediaDownloaderService

// Export types for better TypeScript support
export type MediaDownloaderServiceType = typeof MediaDownloaderService
export type ServiceEntities = {
  files: typeof Files
  users: typeof Users
  devices: typeof Devices
  userFiles: typeof UserFiles
  userDevices: typeof UserDevices
}

/**
 * Collection queries for JOIN-like operations
 */
export const collections = MediaDownloaderService.collections

/**
 * Direct entity access for simple operations
 */
export const entities = MediaDownloaderService.entities

/**
 * Build entity mapping for table name routing.
 * Only includes entities for environment variables that are actually defined.
 * This ensures we maintain least privilege while supporting the DynamoDB compatibility layer.
 */
export function getTableEntityMapping(): Record<string, any> {
  const mapping: Record<string, any> = {}

  if (process.env.DynamoDBTableFiles) {
    mapping[process.env.DynamoDBTableFiles] = Files
  }
  if (process.env.DynamoDBTableUsers) {
    mapping[process.env.DynamoDBTableUsers] = Users
  }
  if (process.env.DynamoDBTableDevices) {
    mapping[process.env.DynamoDBTableDevices] = Devices
  }
  if (process.env.DynamoDBTableUserFiles) {
    mapping[process.env.DynamoDBTableUserFiles] = UserFiles
  }
  if (process.env.DynamoDBTableUserDevices) {
    mapping[process.env.DynamoDBTableUserDevices] = UserDevices
  }

  return mapping
}
