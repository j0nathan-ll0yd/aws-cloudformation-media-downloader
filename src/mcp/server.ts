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
import {handleConventionsQuery} from './handlers/conventions.js'
import type {ConventionQueryArgs} from './handlers/conventions.js'
import {handleCoverageQuery} from './handlers/coverage.js'
import type {CoverageQueryArgs} from './handlers/coverage.js'
import {handleValidationQuery} from './handlers/validation.js'
import type {ValidationQueryArgs} from './handlers/validation.js'
import {handleImpactQuery} from './handlers/impact.js'
import type {ImpactQueryArgs} from './handlers/impact.js'
import {handleTestScaffoldQuery} from './handlers/test-scaffold.js'
import type {TestScaffoldQueryArgs} from './handlers/test-scaffold.js'
import {handleNamingValidationQuery, handleTypeAlignmentQuery} from './handlers/naming.js'
import {handleIndexCodebase, handleSemanticSearch} from './handlers/semantics.js'
import type {SemanticSearchArgs} from './handlers/semantics.js'
import {handleApplyConvention} from './handlers/apply-convention.js'
import type {ApplyConventionArgs} from './handlers/apply-convention.js'
import {handleSemanticDiffQuery} from './handlers/git/semantic-diff.js'
import type {SemanticDiffArgs} from './handlers/git/semantic-diff.js'
import {handleRenameSymbolQuery} from './handlers/refactoring/rename-symbol.js'
import type {RenameSymbolArgs} from './handlers/refactoring/rename-symbol.js'
import {handleMigrationQuery} from './handlers/migrations/generator.js'
import type {MigrationArgs} from './handlers/migrations/generator.js'
import {handleGitHistoryQuery} from './handlers/git/history-query.js'
import type {GitHistoryArgs} from './handlers/git/history-query.js'
import {handlePatternConsistencyQuery} from './handlers/cross-repo/pattern-consistency.js'
import type {PatternConsistencyArgs} from './handlers/cross-repo/pattern-consistency.js'
import {handleConventionSyncQuery} from './handlers/cross-repo/convention-sync.js'
import type {SyncConventionsArgs} from './handlers/cross-repo/convention-sync.js'
import {handleExtractModuleQuery} from './handlers/refactoring/extract-module.js'
import type {ExtractModuleArgs} from './handlers/refactoring/extract-module.js'
import {handleInlineConstantQuery} from './handlers/refactoring/inline-constant.js'
import type {InlineConstantArgs} from './handlers/refactoring/inline-constant.js'
import {handleBundleSizeQuery} from './handlers/performance/bundle-size.js'
import type {BundleSizeArgs} from './handlers/performance/bundle-size.js'
import {handleColdStartQuery} from './handlers/performance/cold-start.js'
import type {ColdStartArgs} from './handlers/performance/cold-start.js'

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
      },
      {
        name: 'index_codebase',
        description: 'Re-index the codebase into the semantic vector database (LanceDB)',
        inputSchema: {type: 'object', properties: {}}
      },
      {
        name: 'search_codebase_semantics',
        description: 'Search the codebase using semantic natural language queries',
        inputSchema: {
          type: 'object',
          properties: {
            query: {type: 'string', description: 'Natural language search query'},
            limit: {type: 'number', description: 'Maximum number of results to return (default: 5)'}
          },
          required: ['query']
        }
      },
      {
        name: 'apply_convention',
        description: 'Automatically apply architectural conventions to code (AWS SDK wrappers, ElectroDB mocks, response helpers, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            file: {type: 'string', description: 'File path to apply conventions to'},
            convention: {
              type: 'string',
              description: 'Convention to apply',
              enum: ['aws-sdk-wrapper', 'electrodb-mock', 'response-helper', 'env-validation', 'powertools', 'all']
            },
            dryRun: {type: 'boolean', description: 'Preview changes without applying them (default: false)'}
          },
          required: ['file', 'convention']
        }
      },
      {
        name: 'diff_semantic',
        description: 'Analyze structural code changes between git refs (breaking changes, impact analysis)',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Query type: changes (all structural changes), breaking (only breaking), impact (affected Lambdas/tests)',
              enum: ['changes', 'breaking', 'impact']
            },
            baseRef: {type: 'string', description: 'Base git ref (default: HEAD~1)'},
            headRef: {type: 'string', description: 'Head git ref (default: HEAD)'},
            scope: {type: 'string', description: 'Scope filter: all, src, entities, lambdas', enum: ['all', 'src', 'entities', 'lambdas']}
          },
          required: ['query']
        }
      },
      {
        name: 'refactor_rename_symbol',
        description: 'Type-aware symbol renaming across the codebase with preview, validation, and atomic execution',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Query type: preview (find occurrences), validate (check conflicts), execute (apply rename)',
              enum: ['preview', 'validate', 'execute']
            },
            symbol: {type: 'string', description: 'Current symbol name to rename'},
            newName: {type: 'string', description: 'New name for the symbol (required for validate/execute)'},
            scope: {type: 'string', description: 'Scope: file, module, or project (default: project)', enum: ['file', 'module', 'project']},
            file: {type: 'string', description: 'File path (required when scope is file or module)'},
            type: {type: 'string', description: 'Symbol type filter', enum: ['function', 'variable', 'type', 'interface', 'class', 'all']},
            dryRun: {type: 'boolean', description: 'Preview changes without applying (default: true)'}
          },
          required: ['query', 'symbol']
        }
      },
      {
        name: 'generate_migration',
        description: 'Generate multi-file migration scripts from convention violations',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Query type: plan (analyze violations), script (generate executable), verify (check completeness)',
              enum: ['plan', 'script', 'verify']
            },
            convention: {type: 'string', description: 'Convention to migrate (default: all)', enum: ['aws-sdk', 'electrodb', 'imports', 'response', 'all']},
            scope: {type: 'array', items: {type: 'string'}, description: 'File/directory patterns to include'},
            outputFormat: {type: 'string', description: 'Script format: ts-morph or shell', enum: ['ts-morph', 'codemod', 'shell']},
            execute: {type: 'boolean', description: 'Execute the migration immediately (default: false)'}
          },
          required: ['query']
        }
      },
      {
        name: 'query_git_history',
        description: 'Semantic git history queries for tracking symbol evolution and blame',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Query type: file (annotated history), symbol (evolution tracking), pattern (commit search), blame_semantic (who modified)',
              enum: ['file', 'symbol', 'pattern', 'blame_semantic']
            },
            target: {type: 'string', description: 'Target file path or pattern (for symbol: file:symbolName format)'},
            since: {type: 'string', description: 'Since date filter (e.g., 2024-01-01)'},
            limit: {type: 'number', description: 'Maximum commits to return (default: 10)'}
          },
          required: ['query', 'target']
        }
      },
      {
        name: 'analyze_pattern_consistency',
        description: 'Detect pattern drift and consistency issues across the codebase',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Query type: scan (find patterns), compare (against reference), drift (detect deviations)',
              enum: ['scan', 'compare', 'drift']
            },
            pattern: {
              type: 'string',
              description: 'Pattern to analyze',
              enum: ['error-handling', 'entity-access', 'aws-vendor', 'env-access', 'handler-export']
            },
            paths: {type: 'array', items: {type: 'string'}, description: 'File/directory paths to analyze'},
            referenceImpl: {type: 'string', description: 'Reference implementation file path for comparison'}
          },
          required: ['query']
        }
      },
      {
        name: 'sync_conventions',
        description: 'Import/export conventions for multi-repo consistency',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Query type: export (to shareable format), import (from external), diff (compare with external)',
              enum: ['import', 'export', 'diff']
            },
            source: {type: 'string', description: 'Source URL or file path for import/diff'},
            format: {type: 'string', description: 'Export format', enum: ['json', 'yaml', 'markdown']},
            merge: {type: 'boolean', description: 'Merge with existing conventions on import (default: false)'}
          },
          required: ['query']
        }
      },
      {
        name: 'refactor_extract_module',
        description: 'Extract symbols to a new module with import updates',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Query type: analyze (list extractable symbols), preview (show extraction plan), execute (perform extraction)',
              enum: ['analyze', 'preview', 'execute']
            },
            sourceFile: {type: 'string', description: 'Source file path'},
            symbols: {type: 'array', items: {type: 'string'}, description: 'Symbols to extract'},
            targetModule: {type: 'string', description: 'Target module path for extraction'},
            createBarrel: {type: 'boolean', description: 'Create/update barrel (index.ts) file (default: false)'}
          },
          required: ['query', 'sourceFile', 'targetModule']
        }
      },
      {
        name: 'refactor_inline_constant',
        description: 'Find and inline single-use exported constants',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Query type: find (discover low-use constants), preview (show inlining plan), execute (guidance for manual inlining)',
              enum: ['find', 'preview', 'execute']
            },
            file: {type: 'string', description: 'File to analyze for constants'},
            constant: {type: 'string', description: 'Specific constant name to inline'},
            maxUses: {type: 'number', description: 'Maximum usage count to consider for inlining (default: 3)'}
          },
          required: ['query']
        }
      },
      {
        name: 'analyze_bundle_size',
        description: 'Analyze Lambda bundle sizes and provide optimization suggestions',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Query type: summary (all bundles), breakdown (detailed analysis), compare (between refs), optimize (suggestions)',
              enum: ['summary', 'breakdown', 'compare', 'optimize']
            },
            lambda: {type: 'string', description: 'Lambda function name'},
            compareRef: {type: 'string', description: 'Git ref for comparison (default: HEAD~1)'},
            threshold: {type: 'number', description: 'Size threshold in bytes for alerts (default: 100000)'}
          },
          required: ['query']
        }
      },
      {
        name: 'analyze_cold_start',
        description: 'Estimate cold start impact from bundle and import analysis',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Query type: estimate (predict cold start), compare (different memory configs), optimize (recommendations)',
              enum: ['estimate', 'compare', 'optimize']
            },
            lambda: {type: 'string', description: 'Lambda function name'},
            memory: {type: 'number', description: 'Memory allocation in MB (default: 1024)'}
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

      case 'index_codebase':
        return await handleIndexCodebase()

      case 'search_codebase_semantics':
        return await handleSemanticSearch(args as unknown as SemanticSearchArgs)

      case 'apply_convention':
        return wrapResult(await handleApplyConvention(args as unknown as ApplyConventionArgs))

      case 'diff_semantic':
        return wrapResult(await handleSemanticDiffQuery(args as unknown as SemanticDiffArgs))

      case 'refactor_rename_symbol':
        return wrapResult(await handleRenameSymbolQuery(args as unknown as RenameSymbolArgs))

      case 'generate_migration':
        return wrapResult(await handleMigrationQuery(args as unknown as MigrationArgs))

      case 'query_git_history':
        return wrapResult(await handleGitHistoryQuery(args as unknown as GitHistoryArgs))

      case 'analyze_pattern_consistency':
        return wrapResult(await handlePatternConsistencyQuery(args as unknown as PatternConsistencyArgs))

      case 'sync_conventions':
        return wrapResult(await handleConventionSyncQuery(args as unknown as SyncConventionsArgs))

      case 'refactor_extract_module':
        return wrapResult(await handleExtractModuleQuery(args as unknown as ExtractModuleArgs))

      case 'refactor_inline_constant':
        return wrapResult(await handleInlineConstantQuery(args as unknown as InlineConstantArgs))

      case 'analyze_bundle_size':
        return wrapResult(await handleBundleSizeQuery(args as unknown as BundleSizeArgs))

      case 'analyze_cold_start':
        return wrapResult(await handleColdStartQuery(args as unknown as ColdStartArgs))

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
