import type {ToolDefinition} from '../types.js'
import {handleColdStartQuery} from '../../handlers/performance/cold-start.js'
import type {ColdStartArgs} from '../../handlers/performance/cold-start.js'

export const analyzeColdStartTool: ToolDefinition = {
  name: 'analyze_cold_start',
  description: `Estimate cold start impact from bundle and import analysis.

Examples:
- Estimate all: {query: "estimate"}
- Single Lambda: {query: "estimate", lambda: "ListFiles", memory: 512}
- Compare memory: {query: "compare", lambda: "ListFiles"}
- Optimize: {query: "optimize", lambda: "ListFiles"}`,
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
}
