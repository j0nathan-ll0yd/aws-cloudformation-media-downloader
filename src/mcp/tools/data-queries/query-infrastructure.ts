import type {ToolDefinition} from '../types.js'
import {handleInfrastructureQuery} from '../../handlers/infrastructure.js'

export const queryInfrastructureTool: ToolDefinition = {
  name: 'query_infrastructure',
  description: `Query AWS infrastructure configuration.

Examples:
- Get all resources: {resource: "all", query: "config"}
- S3 bucket config: {resource: "s3", query: "config"}
- API Gateway usage: {resource: "apigateway", query: "usage"}`,
  inputSchema: {
    type: 'object',
    properties: {
      resource: {type: 'string', description: 'Resource type (s3, dynamodb, apigateway, sns)', enum: ['s3', 'dynamodb', 'apigateway', 'sns', 'all']},
      query: {type: 'string', description: 'Query type (config, usage, dependencies)', enum: ['config', 'usage', 'dependencies']}
    },
    required: ['resource', 'query']
  },
  handler: (args) => handleInfrastructureQuery(args as {resource?: string; query: string})
}
