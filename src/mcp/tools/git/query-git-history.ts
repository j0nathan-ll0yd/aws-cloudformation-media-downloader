import {defineTool} from '../types.js'
import {handleGitHistoryQuery} from '../../handlers/git/history-query.js'
import type {GitHistoryArgs} from '../../handlers/git/history-query.js'

export const queryGitHistoryTool = defineTool({
  name: 'query_git_history',
  description: `Semantic git history queries for tracking symbol evolution and blame.

Examples:
- File history: {"query": "file", "target": "src/mcp/server.ts"}
- Symbol evolution: {"query": "symbol", "target": "src/mcp/server.ts:handleEntityQuery"}`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Query type: file (annotated history), symbol (evolution tracking), pattern (commit search), blame_semantic (who modified)',
        enum: ['file', 'symbol', 'pattern', 'blame_semantic']
      },
      target: {type: 'string', description: 'Target file path or pattern (for symbol: file:symbolName format)'},
      since: {type: 'string', description: 'Since date filter (e.g., 2024-01-01)'},
      limit: {type: 'number', description: 'Maximum commits to return (default: 10)'}
    },
    required: ['query', 'target']
  },
  handler: (args) => handleGitHistoryQuery(args as unknown as GitHistoryArgs)
})
