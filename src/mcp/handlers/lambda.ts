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

/** */
export async function handleLambdaQuery(args: {lambda?: string; query: string}) {
  const {lambda, query} = args

  // Load configs dynamically
  const lambdaConfigs = await getLambdaConfigs()

  switch (query) {
    case 'list':
      return {lambdas: Object.keys(lambdaConfigs).sort(), count: Object.keys(lambdaConfigs).length}

    case 'config':
      if (lambda && lambdaConfigs[lambda]) {
        return lambdaConfigs[lambda]
      }
      return {error: `Lambda '${lambda}' not found. Available: ${Object.keys(lambdaConfigs).join(', ')}`}

    case 'triggers': {
      const triggers: Record<string, string[]> = {}
      for (const [name, config] of Object.entries(lambdaConfigs)) {
        const trigger = config.trigger
        if (!triggers[trigger]) {
          triggers[trigger] = []
        }
        triggers[trigger].push(name)
      }
      return {triggers}
    }

    case 'dependencies': {
      const deps: Record<string, string[]> = {}
      for (const [name, config] of Object.entries(lambdaConfigs)) {
        deps[name] = config.dependencies
      }
      return {dependencies: deps}
    }

    case 'entities': {
      const entityUsage: Record<string, string[]> = {}
      for (const [name, config] of Object.entries(lambdaConfigs)) {
        entityUsage[name] = config.entities
      }
      return {entityUsage}
    }

    case 'invocations': {
      const invocations = await getLambdaInvocations()
      return {invocations}
    }

    case 'env':
      if (lambda) {
        // Environment variables are defined in Terraform, return a note
        return {
          note: 'Environment variables are defined in terraform/*.tf files',
          suggestion: `Check terraform/${lambda.toLowerCase()}.tf or terraform/variables.tf`
        }
      }
      return {error: 'Lambda name required for env query'}

    case 'all':
      return {lambdas: lambdaConfigs, invocations: await getLambdaInvocations()}

    default:
      return {error: `Unknown query: ${query}`, availableQueries: ['list', 'config', 'triggers', 'dependencies', 'entities', 'invocations', 'env', 'all']}
  }
}
