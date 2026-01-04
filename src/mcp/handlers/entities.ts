/**
 * Entity query handler for MCP server
 * Provides entity schemas and relationships
 *
 * Uses Drizzle ORM with Aurora DSQL for all entity operations.
 *
 * Data is dynamically loaded from:
 * - src/entities/ directory (Entity discovery)
 * - graphrag/metadata.json (relationships)
 */

import {getEntityInfo, getLambdaConfigs} from './data-loader.js'
import {createErrorResponse, createSuccessResponse} from './shared/response-types.js'

/** Handles MCP queries for entity schema and relationship information. */
export async function handleEntityQuery(args: {entity?: string; query: string}) {
  const {entity, query} = args
  const {entities, relationships} = await getEntityInfo()
  switch (query) {
    case 'list':
      return createSuccessResponse({entities, count: entities.length})

    case 'schema':
      if (entity) {
        if (!entities.includes(entity)) {
          return createErrorResponse(`Entity '${entity}' not found`, `Available entities: ${entities.join(', ')}`)
        }
        return createSuccessResponse({
          entity,
          note: 'Schema is defined in src/entities/' + entity + '.ts',
          suggestion: 'Read the entity file for full schema details'
        })
      }
      // Return all entity names with their file locations
      return createSuccessResponse({entities: entities.map((e) => ({name: e, file: `src/entities/${e}.ts`}))})

    case 'relationships': {
      if (entity) {
        // Filter relationships for this entity
        const related = relationships.filter((r) => r.from === entity || r.to === entity)
        return createSuccessResponse({entity, relationships: related})
      }
      return createSuccessResponse({relationships})
    }

    case 'collections': {
      // Collections are defined in src/entities/Collections.ts
      return createSuccessResponse({
        file: 'src/entities/Collections.ts',
        description: 'Service combining entities for JOIN-like queries',
        collections: [
          {name: 'userResources', description: 'Query all files & devices for a user'},
          {name: 'fileUsers', description: 'Get all users associated with a file'},
          {name: 'deviceUsers', description: 'Get all users for a device'},
          {name: 'userSessions', description: 'Get all sessions for a user'},
          {name: 'userAccounts', description: 'Get all accounts for a user'}
        ]
      })
    }

    case 'usage': {
      // Show which Lambdas use which entities
      const lambdaConfigs = await getLambdaConfigs()
      const usage: Record<string, string[]> = {}

      for (const e of entities) {
        usage[e] = []
        for (const [lambdaName, config] of Object.entries(lambdaConfigs)) {
          if (config.entities.includes(e)) {
            usage[e].push(lambdaName)
          }
        }
      }

      return createSuccessResponse({entityUsage: usage})
    }

    case 'all':
      return createSuccessResponse({entities, relationships, collectionsFile: 'src/entities/Collections.ts'})

    default:
      return createErrorResponse(`Unknown query: ${query}`, `Available queries: list, schema, relationships, collections, usage, all`)
  }
}
