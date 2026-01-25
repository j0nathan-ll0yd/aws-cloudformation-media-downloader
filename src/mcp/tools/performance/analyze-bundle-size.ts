import {defineTool} from '../types.js'
import {handleBundleSizeQuery} from '../../handlers/performance/bundle-size.js'
import type {BundleSizeArgs} from '../../handlers/performance/bundle-size.js'

export const analyzeBundleSizeTool = defineTool({
  name: 'analyze_bundle_size',
  description: `Analyze Lambda bundle sizes and provide optimization suggestions.

Examples:
- Get summary: {"query": "summary"}
- Optimize Lambda: {"query": "optimize", "lambda": "ListFiles"}`,
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
})
