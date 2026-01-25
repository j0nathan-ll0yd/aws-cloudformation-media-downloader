import type {ToolDefinition} from '../types.js'
import {handleTypeAlignmentQuery} from '../../handlers/naming.js'

export const checkTypeAlignmentTool: ToolDefinition = {
  name: 'check_type_alignment',
  description: `Check alignment between TypeScript types and TypeSpec API definitions.

Examples:
- Check all: {query: "all"}
- List types: {query: "list"}
- Check specific: {typeName: "User", query: "check"}`,
  inputSchema: {
    type: 'object',
    properties: {
      typeName: {type: 'string', description: 'Specific type name to check (optional, checks all if omitted)'},
      query: {type: 'string', description: 'Query type (check, list, all)', enum: ['check', 'list', 'all']}
    },
    required: ['query']
  },
  handler: (args) => handleTypeAlignmentQuery(args as {typeName?: string; query: 'check' | 'list' | 'all'})
}
