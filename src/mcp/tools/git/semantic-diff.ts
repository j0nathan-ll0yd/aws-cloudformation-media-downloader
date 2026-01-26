import type {ToolDefinition} from '../types.js'
import {handleSemanticDiffQuery} from '../../handlers/git/semantic-diff.js'
import type {SemanticDiffArgs} from '../../handlers/git/semantic-diff.js'

export const semanticDiffTool: ToolDefinition = {
  name: 'diff_semantic',
  description: `Analyze structural code changes between git refs (breaking changes, impact analysis).

Examples:
- All changes: {query: "changes"}
- Breaking only: {query: "breaking"}
- Impact analysis: {query: "impact"}
- Compare refs: {query: "changes", baseRef: "main", headRef: "feature-branch"}
- Scope to entities: {query: "breaking", scope: "entities"}`,
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
}
