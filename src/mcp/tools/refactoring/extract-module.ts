import type {ToolDefinition} from '../types.js'
import {handleExtractModuleQuery} from '../../handlers/refactoring/extract-module.js'
import type {ExtractModuleArgs} from '../../handlers/refactoring/extract-module.js'

export const extractModuleTool: ToolDefinition = {
  name: 'refactor_extract_module',
  description: `Extract symbols to a new module with import updates.

Examples:
- Analyze: {query: "analyze", sourceFile: "src/utils.ts", targetModule: "src/helpers.ts"}
- Preview: {query: "preview", sourceFile: "src/utils.ts", symbols: ["formatDate", "parseDate"], targetModule: "src/date-utils.ts"}
- Execute: {query: "execute", sourceFile: "src/utils.ts", symbols: ["formatDate"], targetModule: "src/date-utils.ts", createBarrel: true}`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Query type: analyze (list extractable symbols), preview (show extraction plan), execute (perform extraction)',
        enum: ['analyze', 'preview', 'execute']
      },
      sourceFile: {type: 'string', description: 'Source file path'},
      symbols: {type: 'array', items: {type: 'string'}, description: 'Symbols to extract'},
      targetModule: {type: 'string', description: 'Target module path for extraction'},
      createBarrel: {type: 'boolean', description: 'Create/update barrel (index.ts) file (default: false)'}
    },
    required: ['query', 'sourceFile', 'targetModule']
  },
  handler: (args) => handleExtractModuleQuery(args as unknown as ExtractModuleArgs)
}
