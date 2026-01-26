import type {ToolDefinition} from '../types.js'
import {handleBundleSizeQuery} from '../../handlers/performance/bundle-size.js'
import type {BundleSizeArgs} from '../../handlers/performance/bundle-size.js'

export const analyzeBundleSizeTool: ToolDefinition = {
  name: 'analyze_bundle_size',
  description: `Analyze Lambda bundle sizes and provide optimization suggestions.

Examples:
- Summary: {query: "summary"}
- Breakdown: {query: "breakdown", lambda: "ListFiles"}
- Compare: {query: "compare", lambda: "ListFiles", compareRef: "main"}
- Optimize: {query: "optimize", lambda: "ListFiles", threshold: 50000}`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Query type: summary (all bundles), breakdown (detailed analysis), compare (between refs), optimize (suggestions)',
        enum: ['summary', 'breakdown', 'compare', 'optimize']
      },
      lambda: {type: 'string', description: 'Lambda function name'},
      compareRef: {type: 'string', description: 'Git ref for comparison (default: HEAD~1)'},
      threshold: {type: 'number', description: 'Size threshold in bytes for alerts (default: 100000)'}
    },
    required: ['query']
  },
  handler: (args) => handleBundleSizeQuery(args as unknown as BundleSizeArgs)
}
