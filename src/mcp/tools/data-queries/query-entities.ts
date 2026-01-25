import {defineTool} from '../types.js'
import {handleEntityQuery} from '../../handlers/entities.js'

export const queryEntitiesTool = defineTool({
  name: 'query_entities',
  description: `Query entity schemas and relationships (uses Drizzle ORM with Aurora DSQL).

Examples:
- List all entities: {"query": "collections"}
- Get schema for Users: {"entity": "Users", "query": "schema"}`,
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
  handler: handleEntityQuery as (args: unknown) => ReturnType<typeof handleEntityQuery>
})
