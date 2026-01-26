import type {ToolDefinition} from '../types.js'
import {handleConventionSyncQuery} from '../../handlers/cross-repo/convention-sync.js'
import type {SyncConventionsArgs} from '../../handlers/cross-repo/convention-sync.js'

export const syncConventionsTool: ToolDefinition = {
  name: 'sync_conventions',
  description: `Import/export conventions for multi-repo consistency.

Examples:
- Export JSON: {query: "export", format: "json"}
- Export markdown: {query: "export", format: "markdown"}
- Import: {query: "import", source: "https://example.com/conventions.json"}
- Diff: {query: "diff", source: "./other-project/conventions.json"}`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Query type: export (to shareable format), import (from external), diff (compare with external)',
        enum: ['import', 'export', 'diff']
      },
      source: {type: 'string', description: 'Source URL or file path for import/diff'},
      format: {type: 'string', description: 'Export format', enum: ['json', 'yaml', 'markdown']},
      merge: {type: 'boolean', description: 'Merge with existing conventions on import (default: false)'}
    },
    required: ['query']
  },
  handler: (args) => handleConventionSyncQuery(args as unknown as SyncConventionsArgs)
}
