import type {ToolDefinition} from '../types.js'
import {handleEntityQuery} from '../../handlers/entities.js'

export const queryEntitiesTool: ToolDefinition = {
  name: 'query_entities',
  description: `Query entity schemas and relationships (uses Drizzle ORM with Aurora DSQL).

Examples:
- Get Users schema: {entity: "Users", query: "schema"}
- List all entities: {query: "collections"}
- Get Files relationships: {entity: "Files", query: "relationships"}`,
  inputSchema: {
    type: 'object',
    properties: {
      entity: {
        type: 'string',
        description: 'Entity name (Users, Files, Devices, UserFiles, UserDevices)',
        enum: ['Users', 'Files', 'Devices', 'UserFiles', 'UserDevices']
      },
      query: {type: 'string', description: 'Query type (schema, relationships, collections)', enum: ['schema', 'relationships', 'collections']}
    },
    required: ['query']
  },
  handler: (args) => handleEntityQuery(args as {entity?: string; query: string})
}
