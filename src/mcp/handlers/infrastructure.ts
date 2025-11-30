/**
 * Infrastructure query handler for MCP server
 * Provides AWS infrastructure configuration
 *
 * Data is dynamically loaded from:
 * - graphrag/metadata.json (services)
 * - build/graph.json (dependencies)
 */

import {getAwsServices, getExternalServices, getLambdaConfigs} from './data-loader.js'

export async function handleInfrastructureQuery(args: {resource?: string; query: string}) {
  const {resource, query} = args

  const [awsServices, externalServices] = await Promise.all([getAwsServices(), getExternalServices()])

  switch (query) {
    case 'services':
      return {aws: awsServices, external: externalServices}

    case 'config':
      if (resource) {
        const awsService = awsServices.find((s) => s.name.toLowerCase() === resource.toLowerCase())
        const extService = externalServices.find((s) => s.name.toLowerCase() === resource.toLowerCase())

        if (awsService) {
          return {
            service: awsService,
            note: 'Configuration is defined in terraform/*.tf files',
            suggestion: 'Check terraform/ directory for resource definitions'
          }
        }
        if (extService) {
          return {service: extService, note: 'External service configuration varies by integration'}
        }
        return {error: `Service '${resource}' not found`}
      }
      return {aws: awsServices, external: externalServices}

    case 'usage': {
      if (!resource) {
        return {error: 'Resource name required for usage query'}
      }

      const lambdaConfigs = await getLambdaConfigs()
      const usedBy: string[] = []

      for (const [name, config] of Object.entries(lambdaConfigs)) {
        if (config.dependencies.some((d) => d.toLowerCase() === resource.toLowerCase())) {
          usedBy.push(name)
        }
      }

      return {resource, usedBy, count: usedBy.length}
    }

    case 'dependencies': {
      const lambdaConfigs = await getLambdaConfigs()
      const serviceDeps: Record<string, string[]> = {}

      for (const service of awsServices) {
        serviceDeps[service.name] = []
        for (const [name, config] of Object.entries(lambdaConfigs)) {
          if (config.dependencies.includes(service.name)) {
            serviceDeps[service.name].push(name)
          }
        }
      }

      return {dependencies: serviceDeps}
    }

    case 'dynamodb':
      return {
        description: 'Single-table design with ElectroDB ORM',
        tableFile: 'terraform/dynamodb.tf',
        entitiesDir: 'src/entities/',
        collectionsFile: 'src/entities/Collections.ts',
        indexes: [
          {name: 'Primary', pk: 'pk', sk: 'sk'}, // fmt: multiline
          {name: 'GSI1', pk: 'gsi1pk', sk: 'gsi1sk', description: 'User-based queries'},
          {name: 'GSI2', pk: 'gsi2pk', sk: 'gsi2sk', description: 'File/Device lookups'}
        ]
      }

    case 's3':
      return {
        description: 'Media file storage with transfer acceleration',
        configFile: 'terraform/s3.tf',
        features: ['Transfer Acceleration', 'Lifecycle policies', 'CloudFront distribution']
      }

    case 'apigateway':
      return {
        description: 'REST API with custom authorizer',
        configFiles: ['terraform/api_gateway.tf', 'terraform/api_gateway_authorizer.tf'],
        authType: 'Better Auth session-based',
        authorizerLambda: 'ApiGatewayAuthorizer'
      }

    case 'all':
      return {aws: awsServices, external: externalServices, terraformDir: 'terraform/', note: 'Use specific resource queries for detailed configuration'}

    default:
      return {error: `Unknown query: ${query}`, availableQueries: ['services', 'config', 'usage', 'dependencies', 'dynamodb', 's3', 'apigateway', 'all']}
  }
}
