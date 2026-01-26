import type {ToolDefinition} from '../types.js'
import {handleDependencyQuery} from '../../handlers/dependencies.js'

export const queryDependenciesTool: ToolDefinition = {
  name: 'query_dependencies',
  description: `Query code dependencies from graph.json.

Examples:
- Check circular deps: {query: "circular"}
- Get file imports: {file: "src/lambdas/ListFiles/src/index.ts", query: "imports"}
- Find dependents: {file: "src/entities/Users.ts", query: "dependents"}
- Transitive deps: {file: "src/lambdas/ListFiles/src/index.ts", query: "transitive"}`,
  inputSchema: {
    type: 'object',
    properties: {
      file: {type: 'string', description: 'File path to analyze'},
      query: {
        type: 'string',
        description: 'Query type (imports, dependents, transitive, circular)',
        enum: ['imports', 'dependents', 'transitive', 'circular']
      }
    },
    required: ['query']
  },
  handler: (args) => handleDependencyQuery(args as {file?: string; query: string})
}
