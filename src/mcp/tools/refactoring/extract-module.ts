import {defineTool} from '../types.js'
import {handleExtractModuleQuery} from '../../handlers/refactoring/extract-module.js'
import type {ExtractModuleArgs} from '../../handlers/refactoring/extract-module.js'

export const refactorExtractModuleTool = defineTool({
  name: 'refactor_extract_module',
  description: `Extract symbols to a new module with import updates.

Examples:
- Analyze extractable: {"query": "analyze", "sourceFile": "src/utils/helpers.ts", "targetModule": "src/utils/date-helpers.ts"}
- Preview extraction: {"query": "preview", "sourceFile": "src/utils/helpers.ts", "targetModule": "src/utils/new.ts", "symbols": ["formatDate"]}`,
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
})
