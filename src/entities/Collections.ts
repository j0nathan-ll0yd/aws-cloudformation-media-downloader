import {Service} from 'electrodb'
import {documentClient} from '../lib/vendor/AWS/DynamoDB'
import {Files} from './Files'
import {Users} from './Users'
import {Devices} from './Devices'
import {UserFiles} from './UserFiles'
import {UserDevices} from './UserDevices'

/**
 * MediaDownloader Service
 *
 * Combines all entities for efficient JOIN-like queries and collection operations.
 * This represents our business domain: how Files, Users, and Devices relate to each other.
 *
 * Collections enable efficient queries like:
 * - Get all files for a user
 * - Get all devices for a user
 * - Get user with their files and devices
 *
 * @example
 * import {collections} from '../../../entities/Collections'
 *
 * // Efficient JOIN query
 * const result = await collections.userWithFiles({userId}).go()
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
    client: documentClient as any,
    table: process.env.DynamoDBTableName || 'MediaDownloader'
  }
)

/**
 * Collections for JOIN-like operations between entities.
 * Use this for efficient multi-entity queries instead of N+1 queries.
 */
export const collections = MediaDownloaderService.collections

/**
 * Direct entity access via the service.
 * Prefer importing entities directly unless you need collections.
 */
export const entities = MediaDownloaderService.entities
