/**
 * Lambda query handler for MCP server
 * Provides Lambda function configurations and dependencies
 *
 * Data is dynamically loaded from:
 * - src/lambdas/ directory (Lambda discovery)
 * - build/graph.json (dependencies)
 * - graphrag/metadata.json (semantic info)
 */

import {getLambdaConfigs, getLambdaInvocations} from './data-loader.js'
import {createErrorResponse, createSuccessResponse} from './shared/response-types.js'

/** Handles MCP queries for Lambda function configuration and triggers. */
export async function handleLambdaQuery(args: {lambda?: string; query: string}) {
  const {lambda, query} = args
  const lambdaConfigs = await getLambdaConfigs() // Load configs dynamically
  switch (query) {
    case 'list':
      return createSuccessResponse({lambdas: Object.keys(lambdaConfigs).sort(), count: Object.keys(lambdaConfigs).length})

    case 'config':
      if (lambda && lambdaConfigs[lambda]) {
        return createSuccessResponse(lambdaConfigs[lambda])
      }
      return createErrorResponse(`Lambda '${lambda}' not found`, `Available: ${Object.keys(lambdaConfigs).join(', ')}`)

    case 'triggers': {
      const triggers: Record<string, string[]> = {}
      for (const [name, config] of Object.entries(lambdaConfigs)) {
        const trigger = config.trigger
        if (!triggers[trigger]) {
          triggers[trigger] = []
        }
        triggers[trigger].push(name)
      }
      return createSuccessResponse({triggers})
    }

    case 'dependencies': {
      const deps: Record<string, string[]> = {}
      for (const [name, config] of Object.entries(lambdaConfigs)) {
        deps[name] = config.dependencies
      }
      return createSuccessResponse({dependencies: deps})
    }

    case 'entities': {
      const entityUsage: Record<string, string[]> = {}
      for (const [name, config] of Object.entries(lambdaConfigs)) {
        entityUsage[name] = config.entities
      }
      return createSuccessResponse({entityUsage})
    }

    case 'invocations': {
      const invocations = await getLambdaInvocations()
      return createSuccessResponse({invocations})
    }

    case 'env':
      if (lambda) {
        // Environment variables are defined in Terraform, return a note
        return createSuccessResponse({
          note: 'Environment variables are defined in terraform/*.tf files',
          suggestion: `Check terraform/${lambda.toLowerCase()}.tf or terraform/variables.tf`
        })
      }
      return createErrorResponse('Lambda name required for env query', 'Provide a Lambda function name')

    case 'all':
      return createSuccessResponse({lambdas: lambdaConfigs, invocations: await getLambdaInvocations()})

    default:
      return createErrorResponse(`Unknown query: ${query}`, 'Available queries: list, config, triggers, dependencies, entities, invocations, env, all')
  }
}
