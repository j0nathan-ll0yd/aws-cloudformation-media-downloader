import type {ToolDefinition} from '../types.js'
import {handleCoverageQuery} from '../../handlers/coverage.js'
import type {CoverageQueryArgs} from '../../handlers/coverage.js'

export const checkCoverageTool: ToolDefinition = {
  name: 'check_coverage',
  description: `Analyze which dependencies need mocking for Vitest tests.

Examples:
- All deps: {file: "src/lambdas/ListFiles/src/index.ts", query: "all"}
- Required mocks: {file: "src/lambdas/ListFiles/src/index.ts", query: "required"}
- Missing mocks: {file: "src/lambdas/ListFiles/src/index.ts", query: "missing"}
- Summary: {file: "src/lambdas/ListFiles/src/index.ts", query: "summary"}`,
  inputSchema: {
    type: 'object',
    properties: {
      file: {type: 'string', description: 'Source file path to analyze for test dependencies (e.g., src/lambdas/ListFiles/src/index.ts)'},
      query: {
        type: 'string',
        description: 'Query type: required (all deps needing mocks), missing (unmocked deps), all (complete analysis), summary (coverage overview)',
        enum: ['required', 'missing', 'all', 'summary']
      }
    },
    required: ['file', 'query']
  },
  handler: (args) => handleCoverageQuery(args as unknown as CoverageQueryArgs)
}
