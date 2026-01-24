# MCP Tool Capability Matrix

This document provides a comprehensive reference for all 23 MCP tools available in the media-downloader server.

**Server**: `src/mcp/server.ts`
**Version**: 1.0.0
**Spec**: MCP 2025-11-25

## Tool Categories

| Category | Count | Tools |
|----------|-------|-------|
| Query | 6 | query_entities, query_lambda, query_infrastructure, query_dependencies, query_conventions, query_git_history |
| Validation | 4 | validate_pattern, check_type_alignment, validate_naming, check_coverage |
| Refactoring | 4 | refactor_rename_symbol, refactor_extract_module, refactor_inline_constant, generate_migration |
| Analysis | 5 | lambda_impact, suggest_tests, analyze_pattern_consistency, analyze_bundle_size, analyze_cold_start |
| Git | 2 | diff_semantic, query_git_history |
| Cross-repo | 1 | sync_conventions |
| Semantic | 2 | search_codebase_semantics, index_codebase |
| Convention | 1 | apply_convention |

## Query Tools (6)

### query_entities

Query entity schemas and relationships using Drizzle ORM with Aurora DSQL.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| entity | string | No | Entity name: Users, Files, Devices, UserFiles, UserDevices |
| query | string | Yes | Query type: schema, relationships, collections |

**Query Types**:
- `schema` - Returns entity schema with field types and constraints
- `relationships` - Shows how entities relate to each other
- `collections` - Lists available entity collections

**Example**: `{query: 'schema', entity: 'Users'}`

### query_lambda

Query Lambda function configurations and dependencies.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| lambda | string | No | Lambda function name |
| query | string | Yes | Query type: config, dependencies, triggers, env, list |

**Query Types**:
- `config` - Returns Lambda configuration (memory, timeout, runtime)
- `dependencies` - Lists imported modules and transitive dependencies
- `triggers` - Shows event sources (API Gateway, S3, SQS, etc.)
- `env` - Lists environment variables
- `list` - Lists all Lambda functions

**Example**: `{query: 'config', lambda: 'ListFiles'}`

### query_infrastructure

Query AWS infrastructure configuration.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| resource | string | Yes | Resource type: s3, dynamodb, apigateway, sns, all |
| query | string | Yes | Query type: config, usage, dependencies |

**Query Types**:
- `config` - Returns resource configuration
- `usage` - Shows which Lambdas use this resource
- `dependencies` - Lists resource dependencies

**Example**: `{resource: 's3', query: 'config'}`

### query_dependencies

Query code dependencies from build/graph.json.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | string | No | File path to analyze |
| query | string | Yes | Query type: imports, dependents, transitive, circular |

**Query Types**:
- `imports` - Lists direct imports for a file
- `dependents` - Lists files that import this file
- `transitive` - Shows full dependency tree
- `circular` - Detects circular dependency chains

**Example**: `{query: 'transitive', file: 'src/lambdas/ListFiles/src/index.ts'}`

### query_conventions

Search project conventions from conventions-tracking.md and wiki documentation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Query type: list, search, category, enforcement, detail, wiki |
| term | string | No | Search term for search/wiki queries |
| category | string | No | Category filter: testing, aws, typescript, git, infrastructure, security, meta, patterns |
| severity | string | No | Severity filter: CRITICAL, HIGH, MEDIUM, LOW |
| convention | string | No | Convention name for detail query |

**Query Types**:
- `list` - Lists all conventions
- `search` - Searches conventions by term
- `category` - Filters by category
- `enforcement` - Shows enforcement status
- `detail` - Returns detailed convention info
- `wiki` - Searches wiki documentation

**Example**: `{query: 'category', category: 'aws', severity: 'CRITICAL'}`

### query_git_history

Semantic git history queries for tracking symbol evolution and blame.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Query type: file, symbol, pattern, blame_semantic |
| target | string | Yes | Target file path or pattern (for symbol: file:symbolName format) |
| since | string | No | Since date filter (for example, 2024-01-01) |
| limit | number | No | Maximum commits to return (default: 10) |

**Query Types**:
- `file` - Annotated file history
- `symbol` - Track symbol evolution across commits
- `pattern` - Search commits by pattern
- `blame_semantic` - Semantic blame showing who modified what

**Example**: `{query: 'symbol', target: 'src/entities/queries/user-queries.ts:getUser'}`

## Validation Tools (4)

### validate_pattern

Validate code against project conventions using AST analysis.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | string | No | File path to validate |
| query | string | Yes | Validation type: all, aws-sdk, electrodb, imports, response, rules, summary |

**Query Types**:
- `all` - Run all 19 validation rules
- `aws-sdk` - Check AWS SDK encapsulation
- `electrodb` - Check entity mocking patterns (legacy)
- `imports` - Validate import order
- `response` - Check response helper usage
- `rules` - List available rules
- `summary` - Summary of violations

**Example**: `{query: 'all', file: 'src/lambdas/ListFiles/src/index.ts'}`

### check_type_alignment

Check alignment between TypeScript types and TypeSpec API definitions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| typeName | string | No | Specific type name to check (checks all if omitted) |
| query | string | Yes | Query type: check, list, all |

**Query Types**:
- `check` - Check specific type alignment
- `list` - List all types
- `all` - Check all types

**Example**: `{query: 'check', typeName: 'UserResponse'}`

### validate_naming

Validate type naming conventions (no DynamoDB* prefix, PascalCase enums, proper suffixes).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | string | No | Specific file to validate (validates all type files if omitted) |
| query | string | Yes | Query type: validate, suggest, all |

**Query Types**:
- `validate` - Validate naming conventions
- `suggest` - Suggest corrections
- `all` - Full validation with suggestions

**Example**: `{query: 'validate', file: 'src/types/domain-models.d.ts'}`

### check_coverage

Analyze which dependencies need mocking for Vitest tests.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | string | Yes | File path to analyze |
| query | string | Yes | Query type: required, missing, all, summary |

**Query Types**:
- `required` - List all dependencies that need mocking
- `missing` - Show dependencies not yet mocked
- `all` - Complete mock analysis
- `summary` - Coverage summary

**Example**: `{query: 'required', file: 'src/lambdas/WebhookFeedly/src/index.ts'}`

## Refactoring Tools (4)

### refactor_rename_symbol

Type-aware symbol renaming across the codebase with preview, validation, and atomic execution.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Query type: preview, validate, execute |
| symbol | string | Yes | Current symbol name to rename |
| newName | string | No | New name for the symbol (required for validate/execute) |
| scope | string | No | Scope: file, module, or project (default: project) |
| file | string | No | File path (required when scope is file or module) |
| type | string | No | Symbol type filter: function, variable, type, interface, class, all |
| dryRun | boolean | No | Preview changes without applying (default: true) |

**Query Types**:
- `preview` - Find all occurrences of symbol
- `validate` - Check for conflicts with new name
- `execute` - Apply the rename (respects dryRun)

**Example**: `{query: 'preview', symbol: 'handleRequest', scope: 'project'}`

### refactor_extract_module

Extract symbols to a new module with import updates.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Query type: analyze, preview, execute |
| sourceFile | string | Yes | Source file path |
| symbols | array | No | Symbols to extract |
| targetModule | string | Yes | Target module path for extraction |
| createBarrel | boolean | No | Create/update barrel (index.ts) file (default: false) |

**Query Types**:
- `analyze` - List extractable symbols
- `preview` - Show extraction plan
- `execute` - Perform extraction

**Example**: `{query: 'analyze', sourceFile: 'src/lib/utils.ts', targetModule: 'src/lib/helpers'}`

### refactor_inline_constant

Find and inline single-use exported constants.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Query type: find, preview, execute |
| file | string | No | File to analyze for constants |
| constant | string | No | Specific constant name to inline |
| maxUses | number | No | Maximum usage count to consider for inlining (default: 3) |

**Query Types**:
- `find` - Discover low-use constants
- `preview` - Show inlining plan
- `execute` - Guidance for manual inlining

**Example**: `{query: 'find', file: 'src/lib/constants.ts', maxUses: 2}`

### generate_migration

Generate multi-file migration scripts from convention violations.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Query type: plan, script, verify |
| convention | string | No | Convention to migrate: aws-sdk, electrodb, imports, response, all (default: all) |
| scope | array | No | File/directory patterns to include |
| outputFormat | string | No | Script format: ts-morph, codemod, shell |
| execute | boolean | No | Execute the migration immediately (default: false) |

**Query Types**:
- `plan` - Analyze violations and create migration plan
- `script` - Generate executable migration script
- `verify` - Check migration completeness

**Example**: `{query: 'plan', convention: 'aws-sdk', scope: ['src/lambdas/**']}`

## Analysis Tools (5)

### lambda_impact

Show what is affected by changing a file (dependents, tests, infrastructure).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | string | Yes | File path to analyze |
| query | string | Yes | Query type: dependents, cascade, tests, infrastructure, all |

**Query Types**:
- `dependents` - Direct dependents of file
- `cascade` - Full cascade of affected files
- `tests` - Affected test files
- `infrastructure` - Affected infrastructure resources
- `all` - Complete impact analysis

**Example**: `{query: 'all', file: 'src/entities/queries/user-queries.ts'}`

### suggest_tests

Generate test file scaffolding with all required mocks.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | string | Yes | Source file to generate tests for |
| query | string | Yes | Query type: scaffold, mocks, fixtures, structure |

**Query Types**:
- `scaffold` - Generate complete test file scaffold
- `mocks` - Generate mock setup code
- `fixtures` - Generate test fixtures
- `structure` - Suggest test structure

**Example**: `{query: 'scaffold', file: 'src/lambdas/NewHandler/src/index.ts'}`

### analyze_pattern_consistency

Detect pattern drift and consistency issues across the codebase.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Query type: scan, compare, drift |
| pattern | string | No | Pattern to analyze: error-handling, entity-access, aws-vendor, env-access, handler-export |
| paths | array | No | File/directory paths to analyze |
| referenceImpl | string | No | Reference implementation file path for comparison |

**Query Types**:
- `scan` - Find instances of pattern
- `compare` - Compare against reference implementation
- `drift` - Detect deviations from standard

**Example**: `{query: 'drift', pattern: 'error-handling', paths: ['src/lambdas/**']}`

### analyze_bundle_size

Analyze Lambda bundle sizes and provide optimization suggestions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Query type: summary, breakdown, compare, optimize |
| lambda | string | No | Lambda function name |
| compareRef | string | No | Git ref for comparison (default: HEAD~1) |
| threshold | number | No | Size threshold in bytes for alerts (default: 100000) |

**Query Types**:
- `summary` - Summary of all bundle sizes
- `breakdown` - Detailed size breakdown for Lambda
- `compare` - Compare sizes between git refs
- `optimize` - Optimization suggestions

**Example**: `{query: 'breakdown', lambda: 'StartFileUpload'}`

### analyze_cold_start

Estimate cold start impact from bundle and import analysis.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Query type: estimate, compare, optimize |
| lambda | string | No | Lambda function name |
| memory | number | No | Memory allocation in MB (default: 1024) |

**Query Types**:
- `estimate` - Predict cold start time
- `compare` - Compare different memory configurations
- `optimize` - Cold start optimization recommendations

**Example**: `{query: 'estimate', lambda: 'ApiGatewayAuthorizer', memory: 512}`

## Git Tools (2)

### diff_semantic

Analyze structural code changes between git refs (breaking changes, impact analysis).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Query type: changes, breaking, impact |
| baseRef | string | No | Base git ref (default: HEAD~1) |
| headRef | string | No | Head git ref (default: HEAD) |
| scope | string | No | Scope filter: all, src, entities, lambdas |

**Query Types**:
- `changes` - All structural changes (added/removed/modified exports)
- `breaking` - Only breaking changes (removed exports, changed signatures)
- `impact` - Affected Lambdas and tests

**Example**: `{query: 'breaking', baseRef: 'main', headRef: 'HEAD'}`

## Cross-repo Tools (1)

### sync_conventions

Import/export conventions for multi-repo consistency.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Query type: import, export, diff |
| source | string | No | Source URL or file path for import/diff |
| format | string | No | Export format: json, yaml, markdown |
| merge | boolean | No | Merge with existing conventions on import (default: false) |

**Query Types**:
- `import` - Import conventions from external source
- `export` - Export conventions to shareable format
- `diff` - Compare with external conventions

**Example**: `{query: 'export', format: 'json'}`

## Semantic Tools (2)

### search_codebase_semantics

Search the codebase using semantic natural language queries.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Natural language search query |
| limit | number | No | Maximum number of results to return (default: 5) |

**Example**: `{query: 'error handling patterns in Lambda handlers', limit: 10}`

### index_codebase

Re-index the codebase into the semantic vector database (LanceDB).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| (none) | - | - | No parameters required |

**Example**: `{}`

**Note**: Run this after significant codebase changes to update semantic search index.

## Convention Tools (1)

### apply_convention

Automatically apply architectural conventions to code (AWS SDK wrappers, entity mocks, response helpers, etc.).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | string | Yes | File path to apply conventions to |
| convention | string | Yes | Convention to apply: aws-sdk-wrapper, entity-mock, response-helper, env-validation, powertools, all |
| dryRun | boolean | No | Preview changes without applying them (default: false) |

**Conventions**:
- `aws-sdk-wrapper` - Convert direct AWS SDK imports to vendor wrappers
- `electrodb-mock` - Update to current entity mocking patterns
- `response-helper` - Use response helper functions
- `env-validation` - Use getRequiredEnv() wrapper
- `powertools` - Apply Powertools conventions
- `all` - Apply all conventions

**Example**: `{file: 'src/lambdas/NewHandler/src/index.ts', convention: 'all', dryRun: true}`

## Quick Reference

| Tool | Primary Use Case | Key Query Types |
|------|------------------|-----------------|
| query_entities | Explore data model | schema, relationships |
| query_lambda | Lambda configuration | config, dependencies, list |
| query_infrastructure | AWS resources | config, usage |
| query_dependencies | Import analysis | transitive, circular |
| query_conventions | Project standards | search, category |
| query_git_history | Code evolution | symbol, blame_semantic |
| validate_pattern | Convention checking | all, summary |
| check_type_alignment | API consistency | check, all |
| validate_naming | Naming standards | validate, suggest |
| check_coverage | Test mock analysis | required, missing |
| refactor_rename_symbol | Safe renaming | preview, execute |
| refactor_extract_module | Module extraction | analyze, preview |
| refactor_inline_constant | Cleanup constants | find, preview |
| generate_migration | Batch migrations | plan, script |
| lambda_impact | Change analysis | all, cascade |
| suggest_tests | Test scaffolding | scaffold, mocks |
| analyze_pattern_consistency | Pattern drift | drift, compare |
| analyze_bundle_size | Size optimization | breakdown, optimize |
| analyze_cold_start | Performance | estimate, optimize |
| diff_semantic | Breaking changes | breaking, impact |
| sync_conventions | Multi-repo sync | export, import |
| search_codebase_semantics | Natural language search | (query string) |
| index_codebase | Update search index | (no params) |
| apply_convention | Auto-fix conventions | (convention name) |
