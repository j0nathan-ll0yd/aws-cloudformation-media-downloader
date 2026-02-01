/**
 * Dependency Cruiser configuration for Media Downloader
 * Enforces architectural rules and prevents unwanted dependencies
 */

module.exports = {
  forbidden: [
    /* Rules that should never be broken */
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies are not allowed',
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: 'no-cross-lambda-imports',
      severity: 'error',
      comment: 'Lambda functions cannot import from each other',
      from: {
        path: '^src/lambdas/([^/]+)/',
      },
      to: {
        path: '^src/lambdas/(?!$1)([^/]+)/',
        pathNot: '^src/lambdas/[^/]+/test/',
      },
    },
    {
      name: 'no-direct-aws-sdk-import',
      severity: 'error',
      comment: 'AWS SDK must be imported through vendor wrappers',
      from: {
        pathNot: '^(src/)?lib/vendor/AWS/',
      },
      to: {
        path: '^@aws-sdk/',
      },
    },
    {
      name: 'no-entity-cross-dependencies',
      severity: 'error',
      comment: 'Entities should not import each other (except Collections and queries/)',
      from: {
        path: '^src/entities/(?!Collections|queries/)([^/]+)\\.ts$',
      },
      to: {
        path: '^src/entities/(?!Collections|queries/)(?!$1)([^/]+)\\.ts$',
      },
    },
    {
      name: 'no-test-imports-in-production',
      severity: 'error',
      comment: 'Production code cannot import test files',
      from: {
        pathNot: '\\.(test|spec)\\.(ts|js)$',
      },
      to: {
        path: '\\.(test|spec)\\.(ts|js)$',
      },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Modules should be imported by something (except entry points)',
      from: {
        orphan: true,
        pathNot: [
          '\\.(test|spec)\\.(ts|js)$',
          '^src/lambdas/[^/]+/src/index\\.ts$',
          '^src/mcp/server\\.ts$',
          '^graphrag/(extract|query)\\.ts$',
          '^scripts/',
          '\\.d\\.ts$',
          '^src/mcp/test/fixtures/',
          '^src/types/', // Type files imported via #types alias
        ],
      },
      to: {},
    },
    {
      name: 'no-orphans-lib',
      severity: 'error',
      comment: 'Library code (src/lib) must not contain orphaned modules - this prevents dead code accumulation',
      from: {
        orphan: true,
        path: '^src/lib/',
        pathNot: [
          '\\.(test|spec)\\.(ts|js)$',
          '\\.d\\.ts$',
        ],
      },
      to: {},
    },
    {
      name: 'no-deprecated',
      comment: 'Do not use deprecated dependencies',
      severity: 'warn',
      from: {},
      to: {
        dependencyTypes: ['deprecated'],
      },
    },
  ],
  allowed: [
    /* Rules that explicitly allow certain patterns */
    {
      comment: 'Allow imports within the same Lambda function',
      from: {
        path: '^src/lambdas/([^/]+)/',
      },
      to: {
        path: '^src/lambdas/$1/',
      },
    },
    {
      comment: 'Allow imports from shared utilities',
      from: {},
      to: {
        path: '^src/(util|types)/',
      },
    },
    {
      comment: 'Allow imports from vendor wrappers',
      from: {},
      to: {
        path: '^src/lib/',
      },
    },
    {
      comment: 'Allow imports from entities',
      from: {},
      to: {
        path: '^src/entities/',
      },
    },
    {
      comment: 'Allow imports within entity queries module',
      from: {
        path: '^src/entities/queries/',
      },
      to: {
        path: '^src/entities/queries/',
      },
    },
    {
      comment: 'Allow test files to import test helpers',
      from: {
        path: '\\.(test|spec)\\.(ts|js)$',
      },
      to: {
        path: '^test/helpers/',
      },
    },
    {
      comment: 'Allow MCP server to import handlers and tools',
      from: {
        path: '^src/mcp/server\\.ts$',
      },
      to: {
        path: '^src/mcp/(handlers|tools)/',
      },
    },
    {
      comment: 'Allow MCP handlers to import shared utilities within handlers',
      from: {
        path: '^src/mcp/handlers/',
      },
      to: {
        path: '^src/mcp/handlers/',
      },
    },
    {
      comment: 'Allow MCP validation rules to import validation types and other rules',
      from: {
        path: '^src/mcp/validation/',
      },
      to: {
        path: '^src/mcp/validation/',
      },
    },
    {
      comment: 'Allow MCP parsers to import other parsers (including tests)',
      from: {
        path: '^src/mcp/parsers/',
      },
      to: {
        path: '^src/mcp/parsers/',
      },
    },
    {
      comment: 'Allow MCP handlers to import validation, parsers, and templates',
      from: {
        path: '^src/mcp/handlers/',
      },
      to: {
        path: '^src/mcp/(validation|parsers|templates)/',
      },
    },
    {
      comment: 'Allow MCP test files to import fixtures',
      from: {
        path: '^src/mcp/.*\\.test\\.ts$',
      },
      to: {
        path: '^src/mcp/test/fixtures/',
      },
    },
    {
      comment: 'Allow Lambda handlers to import config constants',
      from: {
        path: '^src/lambdas/',
      },
      to: {
        path: '^src/config/',
      },
    },
    {
      comment: 'Allow MCP tools to import handlers and types',
      from: {
        path: '^src/mcp/tools/',
      },
      to: {
        path: '^src/mcp/(handlers|tools)/',
      },
    },
  ],
  options: {
    /* Configuration options */
    doNotFollow: {
      path: ['node_modules', 'coverage', 'dist', 'build', '.git'],
    },
    includeOnly: ['^src/', '^lib/', '^types/', '^util/', '^test/'],
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: './tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      mainFields: ['module', 'main', 'types', 'typings'],
      extensions: ['.ts', '.js', '.json'],
    },
  },
};