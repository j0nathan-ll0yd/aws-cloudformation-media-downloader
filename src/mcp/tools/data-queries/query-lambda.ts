import type {ToolDefinition} from '../types.js'
import {handleLambdaQuery} from '../../handlers/lambda.js'

export const queryLambdaTool: ToolDefinition = {
  name: 'query_lambda',
  description: `Query Lambda function configurations and dependencies.

Examples:
- List all Lambdas: {query: "list"}
- Get ListFiles config: {lambda: "ListFiles", query: "config"}
- Get dependencies: {lambda: "CreateFile", query: "dependencies"}
- Get env vars: {lambda: "ListFiles", query: "env"}`,
  inputSchema: {
    type: 'object',
    properties: {
      lambda: {type: 'string', description: 'Lambda function name'},
      query: {type: 'string', description: 'Query type (config, dependencies, triggers, env)', enum: ['config', 'dependencies', 'triggers', 'env', 'list']}
    },
    required: ['query']
  },
  handler: (args) => handleLambdaQuery(args as {lambda?: string; query: string})
}
