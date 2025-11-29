/**
 * ElectroDB Entity Wrapper
 *
 * This module wraps the ElectroDB Entity class to encapsulate the vendor library.
 * Domain entities should import from this wrapper, not directly from 'electrodb'.
 *
 * Follows the same pattern as AWS SDK encapsulation in lib/vendor/AWS/*.
 *
 * NOTE: ElectroDB's TypeScript types use complex conditional types that cannot be
 * properly wrapped in a function without losing type safety. Therefore, we simply
 * re-export the Entity class for encapsulation purposes. Entities must use the
 * Entity constructor directly with 'as const' assertions for proper type inference.
 */
import {Entity} from 'electrodb'
import type {EntityItem} from 'electrodb'
import {documentClient} from '../AWS/DynamoDB'

/**
 * Re-export documentClient for entity configuration.
 * Entities need this to configure their DynamoDB client.
 */
export { documentClient }

/**
 * Re-export Entity class for creating entity instances.
 *
 * IMPORTANT: Entities MUST be created with 'as const' assertion on the schema
 * for proper TypeScript inference of custom indexes.
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/ElectroDB-Testing-Patterns#entity-reference | ElectroDB Entity Usage}
 */
export { Entity }
export type { EntityItem }
