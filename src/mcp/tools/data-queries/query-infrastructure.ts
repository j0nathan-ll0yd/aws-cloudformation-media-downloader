import {defineTool} from '../types.js'
import {handleInfrastructureQuery} from '../../handlers/infrastructure.js'

export const queryInfrastructureTool = defineTool({
  name: 'query_infrastructure',
  description: `Query AWS infrastructure configuration.

Examples:
- Get S3 config: {"resource": "s3", "query": "config"}
- List all resources: {"resource": "all", "query": "usage"}`,
  inputSchema: {
    type: 'object',
    properties: {
      resource: {type: 'string', description: 'Resource type (s3, dynamodb, apigateway, sns)', enum: ['s3', 'dynamodb', 'apigateway', 'sns', 'all']},
      query: {type: 'string', description: 'Query type (config, usage, dependencies)', enum: ['config', 'usage', 'dependencies']}
    },
    required: ['resource', 'query']
  },
  handler: handleInfrastructureQuery as (args: unknown) => ReturnType<typeof handleInfrastructureQuery>
})
