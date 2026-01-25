import {defineTool} from '../types.js'
import {handleIndexCodebase} from '../../handlers/semantics.js'

export const indexCodebaseTool = defineTool({
  name: 'index_codebase',
  description: `Re-index the codebase into the semantic vector database (LanceDB).

Examples:
- Rebuild index: {}`,
  inputSchema: {type: 'object', properties: {}},
  handler: () => handleIndexCodebase()
})
