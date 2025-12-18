#!/usr/bin/env node
/**
 * Model Context Protocol (MCP) Server for Media Downloader
 * Provides queryable interfaces for:
 * - ElectroDB entity schemas and relationships
 * - Lambda function configurations
 * - AWS infrastructure queries
 * - Dependency graph analysis
 * - Project conventions and patterns
 * - Code validation and coverage analysis
 * - Impact analysis and test scaffolding
 */

import {Server} from '@modelcontextprotocol/sdk/server/index.js'
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js'
import {CallToolRequestSchema, ListToolsRequestSchema} from '@modelcontextprotocol/sdk/types.js'
import {handleElectroDBQuery} from './handlers/electrodb.js'
import {handleLambdaQuery} from './handlers/lambda.js'
import {handleInfrastructureQuery} from './handlers/infrastructure.js'
import {ConventionQueryArgs, handleConventionsQuery} from './handlers/conventions.js'
import {CoverageQueryArgs, handleCoverageQuery} from './handlers/coverage.js'
import {handleValidationQuery, ValidationQueryArgs} from './handlers/validation.js'
import {handleImpactQuery, ImpactQueryArgs} from './handlers/impact.js'
import {handleTestScaffoldQuery, TestScaffoldQueryArgs} from './handlers/test-scaffold.js'
import {handleNamingValidationQuery, handleTypeAlignmentQuery} from './handlers/naming.js'

// Create server instance
const server = new Server({name: 'media-downloader-mcp', version: '1.0.0'}, {capabilities: {tools: {}}})

/**
 * Wrap handler result in MCP content format
 */
function wrapResult(result: unknown) {
  return {content: [{type: 'text', text: JSON.stringify(result, null, 2)}]}
}

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      { // fmt: multiline
        name: 'query_entities',
        description: 'Query ElectroDB entity schemas and relationships',
        inputSchema: {
          type: 'object',
          properties: {
            entity: {
              type: 'string',
              description: 'Entity name (Users, Files, Devices, UserFiles, UserDevices)',
              enum: ['Users', 'Files', 'Devices', 'UserFiles', 'UserDevices']
            },
            query: {type: 'string', description: 'Query type (schema, relationships, collections)', enum: ['schema', 'relationships', 'collections']}
          },
          required: ['query']
        }
      },
      {
        name: 'query_lambda',
        description: 'Query Lambda function configurations and dependencies',
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
        }
      },
      {
        name: 'query_infrastructure',
        description: 'Query AWS infrastructure configuration',
        inputSchema: {
          type: 'object',
          properties: {
            resource: {type: 'string', description: 'Resource type (s3, dynamodb, apigateway, sns)', enum: ['s3', 'dynamodb', 'apigateway', 'sns', 'all']},
            query: {type: 'string', description: 'Query type (config, usage, dependencies)', enum: ['config', 'usage', 'dependencies']}
          },
          required: ['resource', 'query']
        }
      },
      {
        name: 'query_dependencies',
        description: 'Query code dependencies from graph.json',
        inputSchema: {
          type: 'object',
          properties: {
            file: {type: 'string', description: 'File path to analyze'},
            query: {
              type: 'string',
              description: 'Query type (imports, dependents, transitive, circular)',
              enum: ['imports', 'dependents', 'transitive', 'circular']
            }
          },
          required: ['query']
        }
      },
      {
        name: 'query_conventions',
        description: 'Search project conventions from conventions-tracking.md and wiki documentation',
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
        }
      },
      {
        name: 'validate_pattern',
        description: 'Validate code against project conventions using AST analysis',
        inputSchema: {
          type: 'object',
          properties: {
            file: {type: 'string', description: 'File path to validate'},
            query: {
              type: 'string',
              description: 'Validation type (all, aws-sdk, electrodb, imports, response, rules, summary)',
              enum: ['all', 'aws-sdk', 'electrodb', 'imports', 'response', 'rules', 'summary']
            }
          },
          required: ['query']
        }
      },
      {
        name: 'check_coverage',
        description: 'Analyze which dependencies need mocking for Jest tests',
        inputSchema: {
          type: 'object',
          properties: {
            file: {type: 'string', description: 'File path to analyze'},
            query: {type: 'string', description: 'Query type (required, missing, all, summary)', enum: ['required', 'missing', 'all', 'summary']}
          },
          required: ['file', 'query']
        }
      },
      {
        name: 'lambda_impact',
        description: 'Show what is affected by changing a file (dependents, tests, infrastructure)',
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
        }
      },
      {
        name: 'suggest_tests',
        description: 'Generate test file scaffolding with all required mocks',
        inputSchema: {
          type: 'object',
          properties: {
            file: {type: 'string', description: 'Source file to generate tests for'},
            query: {type: 'string', description: 'Query type (scaffold, mocks, fixtures, structure)', enum: ['scaffold', 'mocks', 'fixtures', 'structure']}
          },
          required: ['file', 'query']
        }
      },
      {
        name: 'check_type_alignment',
        description: 'Check alignment between TypeScript types and TypeSpec API definitions',
        inputSchema: {
          type: 'object',
          properties: {
            typeName: {type: 'string', description: 'Specific type name to check (optional, checks all if omitted)'},
            query: {type: 'string', description: 'Query type (check, list, all)', enum: ['check', 'list', 'all']}
          },
          required: ['query']
        }
      },
      {
        name: 'validate_naming',
        description: 'Validate type naming conventions (no DynamoDB* prefix, PascalCase enums, proper suffixes)',
        inputSchema: {
          type: 'object',
          properties: {
            file: {type: 'string', description: 'Specific file to validate (optional, validates all type files if omitted)'},
            query: {type: 'string', description: 'Query type (validate, suggest, all)', enum: ['validate', 'suggest', 'all']}
          },
          required: ['query']
        }
      }
    ]
  }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const {name, arguments: args} = request.params

  try {
    switch (name) {
      case 'query_entities':
        return await handleElectroDBQuery(args as {entity?: string; query: string})

      case 'query_lambda':
        return await handleLambdaQuery(args as {lambda?: string; query: string})

      case 'query_infrastructure':
        return await handleInfrastructureQuery(args as {resource?: string; query: string})

      case 'query_dependencies':
        return await handleDependencyQuery(args as {file?: string; query: string})

      case 'query_conventions':
        return wrapResult(await handleConventionsQuery(args as unknown as ConventionQueryArgs))

      case 'validate_pattern':
        return wrapResult(await handleValidationQuery(args as unknown as ValidationQueryArgs))

      case 'check_coverage':
        return wrapResult(await handleCoverageQuery(args as unknown as CoverageQueryArgs))

      case 'lambda_impact':
        return wrapResult(await handleImpactQuery(args as unknown as ImpactQueryArgs))

      case 'suggest_tests':
        return wrapResult(await handleTestScaffoldQuery(args as unknown as TestScaffoldQueryArgs))

      case 'check_type_alignment':
        return wrapResult(await handleTypeAlignmentQuery(args as {typeName?: string; query: 'check' | 'list' | 'all'}))

      case 'validate_naming':
        return wrapResult(await handleNamingValidationQuery(args as {file?: string; query: 'validate' | 'suggest' | 'all'}))

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error) {
    return {content: [{type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}`}]}
  }
})

interface GraphFileData {
  imports?: string[]
}

interface GraphData {
  graph: Record<string, GraphFileData>
  transitiveDependencies: Record<string, string[]>
  circularDependencies?: string[][]
}

/**
 * Handle dependency graph queries
 */
async function handleDependencyQuery(args: {file?: string; query: string}) {
  const fs = await import('fs/promises')
  const path = await import('path')

  const graphPath = path.join(process.cwd(), 'build', 'graph.json')
  const graphData: GraphData = JSON.parse(await fs.readFile(graphPath, 'utf-8'))

  const {file, query} = args

  switch (query) {
    case 'imports': {
      if (!file) {
        return {content: [{type: 'text', text: 'File path required for imports query'}]}
      }
      const imports = graphData.graph[file]?.imports || []
      return {content: [{type: 'text', text: JSON.stringify({file, imports}, null, 2)}]}
    }

    case 'transitive': {
      if (!file) {
        return {content: [{type: 'text', text: 'File path required for transitive dependencies query'}]}
      }
      const transitive = graphData.transitiveDependencies[file] || []
      return {content: [{type: 'text', text: JSON.stringify({file, transitiveDependencies: transitive}, null, 2)}]}
    }

    case 'circular':
      return {content: [{type: 'text', text: JSON.stringify({circularDependencies: graphData.circularDependencies || []}, null, 2)}]}

    case 'dependents': {
      if (!file) {
        // List all files with their dependent counts
        const dependents: Record<string, string[]> = {}
        for (const [sourceFile, data] of Object.entries(graphData.graph)) {
          for (const importedFile of data.imports || []) {
            if (!dependents[importedFile]) {
              dependents[importedFile] = []
            }
            dependents[importedFile].push(sourceFile)
          }
        }
        return {content: [{type: 'text', text: JSON.stringify(dependents, null, 2)}]}
      } else {
        // Find who imports this specific file
        const dependents: string[] = []
        for (const [sourceFile, data] of Object.entries(graphData.graph)) {
          if (data.imports?.includes(file)) {
            dependents.push(sourceFile)
          }
        }
        return {content: [{type: 'text', text: JSON.stringify({file, dependents}, null, 2)}]}
      }
    }

    default:
      return {content: [{type: 'text', text: `Unknown query type: ${query}`}]}
  }
}

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('MCP Server running on stdio')
}

main().catch(console.error)
