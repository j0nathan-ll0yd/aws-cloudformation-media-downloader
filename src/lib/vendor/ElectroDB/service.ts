/**
 * ElectroDB Service Wrapper
 *
 * This module wraps the ElectroDB Service class to encapsulate the vendor library.
 * Domain layer should import from this wrapper, not directly from 'electrodb'.
 *
 * Follows the same pattern as AWS SDK encapsulation in lib/vendor/AWS/*.
 */
import {Entity, Service} from 'electrodb'
import type {DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb'
import {documentClient} from '../AWS/DynamoDB'

/**
 * Entity map type constraint for createService.
 * Uses ElectroDB's Entity type with loosened generic constraints.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EntityMapConstraint = Record<string, Entity<any, any, any, any>>

/**
 * Re-export documentClient for service configuration.
 * Services need this to configure their DynamoDB client.
 */
export { documentClient }

/**
 * Creates an ElectroDB Service with the provided entities and configuration.
 *
 * A Service combines multiple entities to enable efficient JOIN-like queries
 * through collections. This is the ONLY way services should be created -
 * never import Service from 'electrodb' directly.
 *
 * NOTE: This function is generic to preserve TypeScript type inference for
 * collections. The entity types are passed through to the Service constructor,
 * allowing ElectroDB to infer collection types correctly.
 *
 * @param entities - Map of entity names to entity instances
 * @param config - Service configuration (client, table name)
 * @returns Configured ElectroDB service instance with full type inference
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/ElectroDB-Testing-Patterns#collections-testing-join-operations | ElectroDB Service Usage}
 */
export function createService<E extends EntityMapConstraint>(
  entities: E,
  config: { client: DynamoDBDocumentClient; table?: string }
) {
  return new Service(entities, config)
}

/**
 * Re-export Service type for type annotations (not for instantiation).
 * Use createService() to create instances.
 */
export type { Service }
