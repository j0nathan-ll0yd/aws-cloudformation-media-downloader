import type {ToolDefinition} from '../types.js'
import {handleConventionsQuery} from '../../handlers/conventions.js'
import type {ConventionQueryArgs} from '../../handlers/conventions.js'

export const queryConventionsTool: ToolDefinition = {
  name: 'query_conventions',
  description: `Search project conventions from conventions-tracking.md and wiki documentation.

Examples:
- List all conventions: {query: "list"}
- Search by term: {query: "search", term: "mock"}
- By category: {query: "category", category: "testing"}
- CRITICAL severity: {query: "list", severity: "CRITICAL"}
- Convention detail: {query: "detail", convention: "aws-sdk-vendor-encapsulation"}`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Query type (list, search, category, enforcement, detail, wiki)',
        enum: ['list', 'search', 'category', 'enforcement', 'detail', 'wiki']
      },
      term: {type: 'string', description: 'Search term for search/wiki queries'},
      category: {type: 'string', description: 'Category filter (testing, aws, typescript, git, infrastructure, security, meta, patterns)'},
      severity: {type: 'string', description: 'Severity filter (CRITICAL, HIGH, MEDIUM, LOW)', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']},
      convention: {type: 'string', description: 'Convention name for detail query'}
    },
    required: ['query']
  },
  handler: (args) => handleConventionsQuery(args as unknown as ConventionQueryArgs)
}
