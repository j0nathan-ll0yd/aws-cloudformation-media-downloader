import {defineTool} from '../types.js'
import {handleSemanticDiffQuery} from '../../handlers/git/semantic-diff.js'
import type {SemanticDiffArgs} from '../../handlers/git/semantic-diff.js'

export const diffSemanticTool = defineTool({
  name: 'diff_semantic',
  description: `Analyze structural code changes between git refs (breaking changes, impact analysis).

Examples:
- Find breaking changes: {"query": "breaking"}
- Analyze impact vs main: {"query": "impact", "baseRef": "main"}`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Query type: changes (all structural changes), breaking (only breaking), impact (affected Lambdas/tests)',
        enum: ['changes', 'breaking', 'impact']
      },
      baseRef: {type: 'string', description: 'Base git ref (default: HEAD~1)'},
      headRef: {type: 'string', description: 'Head git ref (default: HEAD)'},
      scope: {type: 'string', description: 'Scope filter: all, src, entities, lambdas', enum: ['all', 'src', 'entities', 'lambdas']}
    },
    required: ['query']
  },
  handler: (args) => handleSemanticDiffQuery(args as unknown as SemanticDiffArgs)
})
