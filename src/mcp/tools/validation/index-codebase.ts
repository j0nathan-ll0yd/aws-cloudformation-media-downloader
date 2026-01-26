import type {ToolDefinition} from '../types.js'
import {handleIndexCodebase} from '../../handlers/semantics.js'

export const indexCodebaseTool: ToolDefinition = {
  name: 'index_codebase',
  description: `Re-index the codebase into the semantic vector database (LanceDB).

Examples:
- Index all: {}
Note: This operation may take several minutes for large codebases.`,
  inputSchema: {type: 'object', properties: {}},
  handler: () => handleIndexCodebase()
}
