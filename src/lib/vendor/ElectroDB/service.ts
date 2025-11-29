/**
 * ElectroDB Service Wrapper
 *
 * This module wraps the ElectroDB Service class to encapsulate the vendor library.
 * Domain layer should import from this wrapper, not directly from 'electrodb'.
 *
 * Follows the same pattern as AWS SDK encapsulation in lib/vendor/AWS/*.
 */
import {Service, Entity} from 'electrodb'
import type {DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb'
import {documentClient} from '../AWS/DynamoDB'

/**
 * Entity map type for createService.
 * Uses ElectroDB's Entity type with loosened generic constraints.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EntityMap = Record<string, Entity<any, any, any, any>>

/**
 * Re-export documentClient for service configuration.
 * Services need this to configure their DynamoDB client.
 */
export {documentClient}

/**
 * Creates an ElectroDB Service with the provided entities and configuration.
 *
 * A Service combines multiple entities to enable efficient JOIN-like queries
 * through collections. This is the ONLY way services should be created -
 * never import Service from 'electrodb' directly.
 *
 * @param entities - Map of entity names to entity instances
 * @param config - Service configuration (client, table name)
 * @returns Configured ElectroDB service instance
 *
 * @example
 * import {createService, documentClient} from '../../lib/vendor/ElectroDB/service'
 * import {Files} from './Files'
 * import {Users} from './Users'
 *
 * export const MediaDownloaderService = createService(
 *   {
 *     files: Files,
 *     users: Users
 *   },
 *   {
 *     client: documentClient,
 *     table: process.env.DynamoDBTableName
 *   }
 * )
 *
 * // Access collections for JOIN queries
 * export const collections = MediaDownloaderService.collections
 */
export function createService(entities: EntityMap, config: {client: DynamoDBDocumentClient; table?: string}) {
  return new Service(entities, config)
}

/**
 * Re-export Service type for type annotations (not for instantiation).
 * Use createService() to create instances.
 */
export type {Service}
