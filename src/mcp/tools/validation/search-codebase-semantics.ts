import type {ToolDefinition} from '../types.js'
import {handleSemanticSearch} from '../../handlers/semantics.js'
import type {SemanticSearchArgs} from '../../handlers/semantics.js'

export const searchCodebaseSemanticsTool: ToolDefinition = {
  name: 'search_codebase_semantics',
  description: `Search the codebase using semantic natural language queries.

Examples:
- Find handlers: {query: "Lambda handlers that process user files"}
- Find patterns: {query: "error handling with response helpers", limit: 10}
- Find entities: {query: "user authentication logic"}`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {type: 'string', description: 'Natural language search query'},
      limit: {type: 'number', description: 'Maximum number of results to return (default: 5)'}
    },
    required: ['query']
  },
  handler: (args) => handleSemanticSearch(args as unknown as SemanticSearchArgs)
}
