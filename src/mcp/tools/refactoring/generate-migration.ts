import type {ToolDefinition} from '../types.js'
import {handleMigrationQuery} from '../../handlers/migrations/generator.js'
import type {MigrationArgs} from '../../handlers/migrations/generator.js'

export const generateMigrationTool: ToolDefinition = {
  name: 'generate_migration',
  description: `Generate multi-file migration scripts from convention violations.

Examples:
- Plan all: {query: "plan"}
- AWS SDK migration: {query: "plan", convention: "aws-sdk"}
- Generate script: {query: "script", convention: "entity", outputFormat: "ts-morph"}
- Verify: {query: "verify", convention: "response"}`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Query type: plan (analyze violations), script (generate executable), verify (check completeness)',
        enum: ['plan', 'script', 'verify']
      },
      convention: {type: 'string', description: 'Convention to migrate (default: all)', enum: ['aws-sdk', 'entity', 'imports', 'response', 'all']},
      scope: {type: 'array', items: {type: 'string'}, description: 'File/directory patterns to include'},
      outputFormat: {type: 'string', description: 'Script format: ts-morph or shell', enum: ['ts-morph', 'codemod', 'shell']},
      execute: {type: 'boolean', description: 'Execute the migration immediately (default: false)'}
    },
    required: ['query']
  },
  handler: (args) => handleMigrationQuery(args as unknown as MigrationArgs)
}
