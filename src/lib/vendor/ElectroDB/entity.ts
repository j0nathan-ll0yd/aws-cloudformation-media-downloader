/**
 * ElectroDB Entity Wrapper
 *
 * This module wraps the ElectroDB Entity class to encapsulate the vendor library.
 * Domain entities should import from this wrapper, not directly from 'electrodb'.
 *
 * Follows the same pattern as AWS SDK encapsulation in lib/vendor/AWS/*.
 */
import {Entity} from 'electrodb'
import {documentClient} from '../AWS/DynamoDB'

/**
 * Re-export documentClient for entity configuration.
 * Entities need this to configure their DynamoDB client.
 */
export {documentClient}

/**
 * Creates an ElectroDB Entity with the provided configuration.
 *
 * This is the ONLY way entities should be created - never import Entity from 'electrodb' directly.
 *
 * @param schema - ElectroDB entity configuration (model, attributes, indexes, etc.)
 * @param config - Entity configuration (table name, client)
 * @returns Configured ElectroDB entity instance
 *
 * @example
 * import {createEntity, documentClient} from '../../lib/vendor/ElectroDB/entity'
 *
 * export const Files = createEntity({
 *   model: {
 *     entity: 'File',
 *     version: '1',
 *     service: 'mediadownloader'
 *   },
 *   attributes: { ... },
 *   indexes: { ... }
 * }, {
 *   table: process.env.DynamoDBTableFiles,
 *   client: documentClient
 * })
 */
export function createEntity(schema: any, config: {table?: string; client: any}) {
  return new Entity(schema, config)
}

/**
 * Re-export Entity type for type annotations (not for instantiation).
 * Use createEntity() to create instances.
 */
export type {Entity}
