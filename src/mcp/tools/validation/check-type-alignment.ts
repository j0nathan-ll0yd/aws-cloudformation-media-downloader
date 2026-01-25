import {defineTool} from '../types.js'
import {handleTypeAlignmentQuery} from '../../handlers/naming.js'

export const checkTypeAlignmentTool = defineTool({
  name: 'check_type_alignment',
  description: `Check alignment between TypeScript types and TypeSpec API definitions.

Examples:
- Check all types: {"query": "all"}
- Check specific type: {"typeName": "User", "query": "check"}`,
  inputSchema: {
    type: 'object',
    properties: {
      typeName: {type: 'string', description: 'Specific type name to check (optional, checks all if omitted)'},
      query: {type: 'string', description: 'Query type (check, list, all)', enum: ['check', 'list', 'all']}
    },
    required: ['query']
  },
  handler: (args) => handleTypeAlignmentQuery(args as {typeName?: string; query: 'check' | 'list' | 'all'})
})
