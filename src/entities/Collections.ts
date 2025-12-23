import {createService, documentClient} from '#lib/vendor/ElectroDB/service'
import {Files} from './Files'
import {FileDownloads} from './FileDownloads'
import {Users} from './Users'
import {Devices} from './Devices'
import {UserFiles} from './UserFiles'
import {UserDevices} from './UserDevices'
import {Sessions} from './Sessions'
import {Accounts} from './Accounts'
import {VerificationTokens} from './VerificationTokens'

/**
 * MediaDownloader Service
 *
 * Combines all entities in a single-table design for efficient JOIN-like queries.
 * ElectroDB Collections enable queries across entity boundaries using shared GSI keys.
 *
 * Available Collections:
 *
 * 1. **userResources** (UserCollection/gsi1)
 *    - Query: Get all files and devices for a user
 *    - Entities: Users, UserFiles, UserDevices
 *    - Access pattern: collections.userResources(userId).go()
 *    - Used by: ListFiles, UserDelete, RegisterDevice
 *
 * 2. **fileUsers** (FileCollection/gsi2)
 *    - Query: Get all users associated with a file
 *    - Entities: Files, UserFiles
 *    - Access pattern: collections.fileUsers(fileId).go()
 *    - Used by: S3ObjectCreated (for push notifications)
 *
 * 3. **deviceUsers** (DeviceCollection/gsi3)
 *    - Query: Get all users associated with a device
 *    - Entities: Devices, UserDevices
 *    - Access pattern: collections.deviceUsers(deviceId).go()
 *    - Used by: PruneDevices (for cleanup)
 *
 * 4. **userSessions** (gsi1)
 *    - Query: Get all sessions for a user
 *    - Entities: Sessions
 *    - Access pattern: `collections.userSessions(\{userId\}).go()`
 *    - Used by: LoginUser, RefreshToken, Logout
 *
 * 5. **userAccounts** (gsi1)
 *    - Query: Get all OAuth accounts for a user
 *    - Entities: Accounts
 *    - Access pattern: `collections.userAccounts(\{userId\}).go()`
 *    - Used by: Better Auth adapter for account linking
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/ElectroDB-Testing-Patterns#collections-testing-join-operations | Collections Usage Examples}
 */
export const MediaDownloaderService = createService({
  files: Files,
  fileDownloads: FileDownloads,
  users: Users,
  devices: Devices,
  userFiles: UserFiles,
  userDevices: UserDevices,
  sessions: Sessions,
  accounts: Accounts,
  verificationTokens: VerificationTokens
}, {client: documentClient, table: process.env.DYNAMODB_TABLE_NAME || 'MediaDownloader'})

/**
 * Collections for JOIN-like operations between entities.
 * Use these instead of N+1 queries or full table scans.
 *
 * Collections leverage GSIs to fetch related entities in a single query:
 * - userResources: Get user's files and devices via UserCollection (gsi1)
 * - fileUsers: Get users for a file via FileCollection (gsi2)
 * - deviceUsers: Get users for a device via DeviceCollection (gsi3)
 */
export const collections = MediaDownloaderService.collections

/**
 * Direct entity access via the service.
 * Prefer importing entities directly unless you need collections.
 */
export const entities = MediaDownloaderService.entities
