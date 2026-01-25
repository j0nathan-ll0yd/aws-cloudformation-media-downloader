import {defineTool} from '../types.js'
import {handleColdStartQuery} from '../../handlers/performance/cold-start.js'
import type {ColdStartArgs} from '../../handlers/performance/cold-start.js'

export const analyzeColdStartTool = defineTool({
  name: 'analyze_cold_start',
  description: `Estimate cold start impact from bundle and import analysis.

Examples:
- Estimate cold start: {"query": "estimate", "lambda": "ListFiles"}
- Get optimization tips: {"query": "optimize"}`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Query type: estimate (predict cold start), compare (different memory configs), optimize (recommendations)',
        enum: ['estimate', 'compare', 'optimize']
      },
      lambda: {type: 'string', description: 'Lambda function name'},
      memory: {type: 'number', description: 'Memory allocation in MB (default: 1024)'}
    },
    required: ['query']
  },
  handler: (args) => handleColdStartQuery(args as unknown as ColdStartArgs)
})
