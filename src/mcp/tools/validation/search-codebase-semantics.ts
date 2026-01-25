import {defineTool} from '../types.js'
import {handleSemanticSearch} from '../../handlers/semantics.js'
import type {SemanticSearchArgs} from '../../handlers/semantics.js'

export const searchCodebaseSemanticsTool = defineTool({
  name: 'search_codebase_semantics',
  description: `Search the codebase using semantic natural language queries.

Examples:
- Find auth code: {"query": "how to handle authentication"}
- Search S3 uploads: {"query": "S3 upload", "limit": 10}`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {type: 'string', description: 'Natural language search query'},
      limit: {type: 'number', description: 'Maximum number of results to return (default: 5)'}
    },
    required: ['query']
  },
  handler: (args) => handleSemanticSearch(args as unknown as SemanticSearchArgs)
})
