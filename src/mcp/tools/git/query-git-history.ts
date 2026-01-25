import type {ToolDefinition} from '../types.js'
import {handleGitHistoryQuery} from '../../handlers/git/history-query.js'
import type {GitHistoryArgs} from '../../handlers/git/history-query.js'

export const queryGitHistoryTool: ToolDefinition = {
  name: 'query_git_history',
  description: `Semantic git history queries for tracking symbol evolution and blame.

Examples:
- File history: {query: "file", target: "src/entities/Users.ts"}
- Symbol evolution: {query: "symbol", target: "src/entities/Users.ts:getUserById"}
- Pattern search: {query: "pattern", target: "fix:.*authentication"}
- Blame: {query: "blame_semantic", target: "src/entities/Users.ts"}`,
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
}
