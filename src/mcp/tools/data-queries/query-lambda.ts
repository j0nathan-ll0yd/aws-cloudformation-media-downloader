import {defineTool} from '../types.js'
import {handleLambdaQuery} from '../../handlers/lambda.js'

export const queryLambdaTool = defineTool({
  name: 'query_lambda',
  description: `Query Lambda function configurations and dependencies.

Examples:
- List all Lambdas: {"query": "list"}
- Get config for ListFiles: {"lambda": "ListFiles", "query": "config"}`,
  inputSchema: {
    type: 'object',
    properties: {
      lambda: {type: 'string', description: 'Lambda function name'},
      query: {
        type: 'string',
        description: 'Query type (config, dependencies, triggers, env)',
        enum: ['config', 'dependencies', 'triggers', 'env', 'list']
      }
    },
    required: ['query']
  },
  handler: handleLambdaQuery as (args: unknown) => ReturnType<typeof handleLambdaQuery>
})
