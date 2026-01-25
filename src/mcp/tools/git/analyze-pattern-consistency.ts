import type {ToolDefinition} from '../types.js'
import {handlePatternConsistencyQuery} from '../../handlers/cross-repo/pattern-consistency.js'
import type {PatternConsistencyArgs} from '../../handlers/cross-repo/pattern-consistency.js'

export const analyzePatternConsistencyTool: ToolDefinition = {
  name: 'analyze_pattern_consistency',
  description: `Detect pattern drift and consistency issues across the codebase.

Examples:
- Scan patterns: {query: "scan", pattern: "error-handling"}
- Compare to ref: {query: "compare", pattern: "entity-access", referenceImpl: "src/lambdas/ListFiles/src/index.ts"}
- Detect drift: {query: "drift", pattern: "aws-vendor"}`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Query type: scan (find patterns), compare (against reference), drift (detect deviations)',
        enum: ['scan', 'compare', 'drift']
      },
      pattern: {
        type: 'string',
        description: 'Pattern to analyze',
        enum: ['error-handling', 'entity-access', 'aws-vendor', 'env-access', 'handler-export']
      },
      paths: {type: 'array', items: {type: 'string'}, description: 'File/directory paths to analyze'},
      referenceImpl: {type: 'string', description: 'Reference implementation file path for comparison'}
    },
    required: ['query']
  },
  handler: (args) => handlePatternConsistencyQuery(args as unknown as PatternConsistencyArgs)
}
