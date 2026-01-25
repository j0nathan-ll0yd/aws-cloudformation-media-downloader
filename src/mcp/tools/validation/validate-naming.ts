import type {ToolDefinition} from '../types.js'
import {handleNamingValidationQuery} from '../../handlers/naming.js'

export const validateNamingTool: ToolDefinition = {
  name: 'validate_naming',
  description: `Validate type naming conventions (no DynamoDB* prefix, PascalCase enums, proper suffixes).

Examples:
- Validate all: {query: "validate"}
- Get suggestions: {query: "suggest"}
- Full report: {query: "all"}
- Specific file: {file: "src/types/domain-models.d.ts", query: "validate"}`,
  inputSchema: {
    type: 'object',
    properties: {
      file: {type: 'string', description: 'Specific file to validate (optional, validates all type files if omitted)'},
      query: {type: 'string', description: 'Query type (validate, suggest, all)', enum: ['validate', 'suggest', 'all']}
    },
    required: ['query']
  },
  handler: (args) => handleNamingValidationQuery(args as {file?: string; query: 'validate' | 'suggest' | 'all'})
}
