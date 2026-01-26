import type {ToolDefinition} from '../types.js'
import {handleImpactQuery} from '../../handlers/impact.js'
import type {ImpactQueryArgs} from '../../handlers/impact.js'

export const lambdaImpactTool: ToolDefinition = {
  name: 'lambda_impact',
  description: `Show what is affected by changing a file (dependents, tests, infrastructure).

Examples:
- Full impact: {file: "src/entities/Users.ts", query: "all"}
- Cascade: {file: "src/lib/vendor/AWS/DynamoDB.ts", query: "cascade"}
- Affected tests: {file: "src/entities/Users.ts", query: "tests"}
- Infrastructure: {file: "src/lambdas/ListFiles/src/index.ts", query: "infrastructure"}`,
  inputSchema: {
    type: 'object',
    properties: {
      file: {type: 'string', description: 'File path to analyze'},
      query: {
        type: 'string',
        description: 'Query type (dependents, cascade, tests, infrastructure, all)',
        enum: ['dependents', 'cascade', 'tests', 'infrastructure', 'all']
      }
    },
    required: ['file', 'query']
  },
  handler: (args) => handleImpactQuery(args as unknown as ImpactQueryArgs)
}
