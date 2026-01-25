import {defineTool} from '../types.js'
import {handleRenameSymbolQuery} from '../../handlers/refactoring/rename-symbol.js'
import type {RenameSymbolArgs} from '../../handlers/refactoring/rename-symbol.js'

export const refactorRenameSymbolTool = defineTool({
  name: 'refactor_rename_symbol',
  description: `Type-aware symbol renaming across the codebase with preview, validation, and atomic execution.

Examples:
- Preview rename: {"query": "preview", "symbol": "oldName"}
- Execute rename: {"query": "execute", "symbol": "oldName", "newName": "newName"}`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Query type: preview (find occurrences), validate (check conflicts), execute (apply rename)',
        enum: ['preview', 'validate', 'execute']
      },
      symbol: {type: 'string', description: 'Current symbol name to rename'},
      newName: {type: 'string', description: 'New name for the symbol (required for validate/execute)'},
      scope: {type: 'string', description: 'Scope: file, module, or project (default: project)', enum: ['file', 'module', 'project']},
      file: {type: 'string', description: 'File path (required when scope is file or module)'},
      type: {type: 'string', description: 'Symbol type filter', enum: ['function', 'variable', 'type', 'interface', 'class', 'all']},
      dryRun: {type: 'boolean', description: 'Preview changes without applying (default: true)'}
    },
    required: ['query', 'symbol']
  },
  handler: (args) => handleRenameSymbolQuery(args as unknown as RenameSymbolArgs)
})
