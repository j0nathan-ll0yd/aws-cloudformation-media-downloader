# MCP Server Improvements Implementation Plan

## Overview

This plan implements the Priority 1 recommendations from the MCP Server Evaluation (January 2026):
1. Standardize Response Formatting
2. Add Tool Usage Examples
3. Create Tool Registry with Auto-Registration

## Current State Analysis

### Tool Definitions
- **Location**: `src/mcp/server.ts:69-477` (inline in ListToolsRequestSchema handler)
- **Count**: 24 tools defined as an array of objects
- **Structure**: Each tool has `name`, `description`, `inputSchema`
- **Problem**: Monolithic 626-line file, hard to maintain

### Response Patterns (Inconsistent)
- **5 handlers use response helpers directly**: entities.ts, lambda.ts, infrastructure.ts, semantics.ts, schema-drift.ts
- **17 handlers return raw objects**: wrapped by `wrapResult()` in server.ts
- **1 inline handler**: handleDependencyQuery defined in server.ts
- **wrapResult function**: `src/mcp/server.ts:64-66` duplicates `createSuccessResponse`

### Key Files
- `src/mcp/server.ts` - Main server with inline tool definitions (626 lines)
- `src/mcp/handlers/shared/response-types.ts` - Response helper functions
- `src/mcp/handlers/*.ts` - 26 handler files

## Desired End State

After implementation:
1. All handlers return standardized MCP responses using helper functions
2. All 24 tools have usage examples in their descriptions
3. Tool definitions live in `src/mcp/tools/` with auto-registration
4. `server.ts` is reduced to ~100 lines (routing and initialization only)
5. Adding a new tool requires creating one file (no server.ts modifications)

### Verification
- All existing tests pass
- MCP server responds correctly to all 24 tools
- No functional changes to tool behavior

## What We're NOT Doing

- Adding new tools or features
- Changing tool names or parameters
- Modifying validation rules
- Adding tool versioning (Phase 2 item)
- Adding batch operations (Phase 2 item)

---

## Phase 1: Standardize Response Formatting

### Overview
Update all handlers to use `createSuccessResponse`/`createErrorResponse` directly, removing the need for `wrapResult` in server.ts.

### Changes Required

#### 1. Update conventions.ts
**File**: `src/mcp/handlers/conventions.ts`
**Changes**: Replace all raw object returns with `createSuccessResponse()`

```typescript
// Before (line 49-53)
return {
  conventions: bySeverity,
  count: conventions.length,
  summary: {...}
}

// After
return createSuccessResponse({
  conventions: bySeverity,
  count: conventions.length,
  summary: {...}
})
```

Apply same pattern to all return statements in this file.

#### 2. Update validation.ts
**File**: `src/mcp/handlers/validation.ts`
**Changes**: Replace raw object returns with `createSuccessResponse()`

#### 3. Update coverage.ts
**File**: `src/mcp/handlers/coverage.ts`
**Changes**: Replace raw object returns with `createSuccessResponse()`

#### 4. Update impact.ts
**File**: `src/mcp/handlers/impact.ts`
**Changes**: Replace raw object returns with `createSuccessResponse()`

#### 5. Update test-scaffold.ts
**File**: `src/mcp/handlers/test-scaffold.ts`
**Changes**: Replace raw object returns with `createSuccessResponse()`

#### 6. Update naming.ts
**File**: `src/mcp/handlers/naming.ts`
**Changes**: Replace raw object returns with `createSuccessResponse()`

#### 7. Update apply-convention.ts
**File**: `src/mcp/handlers/apply-convention.ts`
**Changes**: Replace raw object returns with `createSuccessResponse()`

#### 8. Update git/semantic-diff.ts
**File**: `src/mcp/handlers/git/semantic-diff.ts`
**Changes**: Replace raw object returns with `createSuccessResponse()`

#### 9. Update git/history-query.ts
**File**: `src/mcp/handlers/git/history-query.ts`
**Changes**: Replace raw object returns with `createSuccessResponse()`

#### 10. Update refactoring/rename-symbol.ts
**File**: `src/mcp/handlers/refactoring/rename-symbol.ts`
**Changes**: Replace raw object returns with `createSuccessResponse()`

#### 11. Update refactoring/extract-module.ts
**File**: `src/mcp/handlers/refactoring/extract-module.ts`
**Changes**: Replace raw object returns with `createSuccessResponse()`

#### 12. Update refactoring/inline-constant.ts
**File**: `src/mcp/handlers/refactoring/inline-constant.ts`
**Changes**: Replace raw object returns with `createSuccessResponse()`

#### 13. Update migrations/generator.ts
**File**: `src/mcp/handlers/migrations/generator.ts`
**Changes**: Replace raw object returns with `createSuccessResponse()`

#### 14. Update cross-repo/pattern-consistency.ts
**File**: `src/mcp/handlers/cross-repo/pattern-consistency.ts`
**Changes**: Replace raw object returns with `createSuccessResponse()`

#### 15. Update cross-repo/convention-sync.ts
**File**: `src/mcp/handlers/cross-repo/convention-sync.ts`
**Changes**: Replace raw object returns with `createSuccessResponse()`

#### 16. Update performance/bundle-size.ts
**File**: `src/mcp/handlers/performance/bundle-size.ts`
**Changes**: Replace raw object returns with `createSuccessResponse()`

#### 17. Update performance/cold-start.ts
**File**: `src/mcp/handlers/performance/cold-start.ts`
**Changes**: Replace raw object returns with `createSuccessResponse()`

#### 18. Update server.ts routing
**File**: `src/mcp/server.ts`
**Changes**:
- Remove `wrapResult` function (lines 64-66)
- Update all routing calls to remove `wrapResult()` wrapper

```typescript
// Before
case 'query_conventions':
  return wrapResult(await handleConventionsQuery(args as unknown as ConventionQueryArgs))

// After
case 'query_conventions':
  return await handleConventionsQuery(args as unknown as ConventionQueryArgs)
```

#### 19. Extract handleDependencyQuery to its own file
**New File**: `src/mcp/handlers/dependencies.ts`
**Changes**: Move inline handler from server.ts to separate file with proper response formatting

### Success Criteria

#### Automated Verification:
- [ ] Type checking passes: `pnpm run check:types`
- [ ] Test types pass: `pnpm run check:test:types`
- [ ] Linting passes: `pnpm run lint`
- [ ] Formatting passes: `pnpm run format:check`
- [ ] Unit tests pass: `pnpm test`

#### Manual Verification:
- [ ] MCP server starts without errors
- [ ] Each tool returns properly formatted JSON responses
- [ ] Error responses include `isError: true` flag

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Add Tool Usage Examples

### Overview
Add concrete usage examples to all 24 tool descriptions. Examples help users understand expected input/output.

### Changes Required

#### Update all 24 tool definitions in server.ts

Add `examples` array to each tool's description. Format:

```typescript
{
  name: 'query_entities',
  description: `Query entity schemas and relationships (uses Drizzle ORM with Aurora DSQL).

Examples:
- List all entities: {"query": "schema"}
- Get Users schema: {"entity": "Users", "query": "schema"}
- Get entity relationships: {"entity": "Users", "query": "relationships"}`,
  inputSchema: {...}
}
```

### Example Updates for Each Tool

#### 1. query_entities
```
Examples:
- List all entities: {"query": "schema"}
- Get specific entity: {"entity": "Users", "query": "schema"}
- Get relationships: {"query": "relationships"}
```

#### 2. query_lambda
```
Examples:
- List all Lambdas: {"query": "list"}
- Get specific Lambda: {"lambda": "RegisterUser", "query": "config"}
- Get Lambda dependencies: {"lambda": "RegisterUser", "query": "dependencies"}
```

#### 3. query_infrastructure
```
Examples:
- Query S3 buckets: {"resource": "s3", "query": "list"}
- Query Lambda functions: {"resource": "lambda", "query": "list"}
- Query SQS queues: {"resource": "sqs", "query": "list"}
```

#### 4. query_dependencies
```
Examples:
- Get file imports: {"query": "imports", "file": "src/lambdas/RegisterUser/index.ts"}
- Get transitive deps: {"query": "transitive", "file": "src/lambdas/RegisterUser/index.ts"}
- Find circular deps: {"query": "circular"}
```

#### 5. query_conventions
```
Examples:
- List all conventions: {"query": "list"}
- Search for AWS: {"query": "search", "term": "AWS"}
- Get critical only: {"query": "list", "severity": "CRITICAL"}
```

#### 6. validate_pattern
```
Examples:
- Validate single file: {"query": "file", "file": "src/lambdas/RegisterUser/index.ts"}
- Validate all Lambdas: {"query": "all"}
- List available rules: {"query": "rules"}
```

#### 7. check_coverage
```
Examples:
- Check file coverage: {"file": "src/lambdas/RegisterUser/index.ts"}
- Suggest mocks: {"file": "src/lambdas/RegisterUser/index.ts", "suggestMocks": true}
```

#### 8. lambda_impact
```
Examples:
- Check impact: {"file": "src/entities/Users.ts"}
- Check with depth: {"file": "src/entities/Users.ts", "depth": 3}
```

#### 9. suggest_tests
```
Examples:
- Generate test scaffold: {"file": "src/lambdas/RegisterUser/index.ts"}
- Generate with mocks: {"file": "src/lambdas/RegisterUser/index.ts", "includeMocks": true}
```

#### 10. check_type_alignment
```
Examples:
- Check type alignment: {"typespecFile": "tsp/models.tsp", "typescriptFile": "src/types/api.ts"}
```

#### 11. validate_naming
```
Examples:
- Validate file naming: {"file": "src/types/api.ts"}
- Check all types: {"query": "all"}
```

#### 12. index_codebase
```
Examples:
- Reindex codebase: {}
```

#### 13. search_codebase_semantics
```
Examples:
- Search for concept: {"query": "error handling patterns"}
- Search with limit: {"query": "authentication", "limit": 10}
```

#### 14. apply_convention
```
Examples:
- Dry run: {"convention": "aws-sdk-encapsulation", "dryRun": true}
- Apply fix: {"convention": "aws-sdk-encapsulation", "file": "src/lambdas/RegisterUser/index.ts"}
```

#### 15. diff_semantic
```
Examples:
- Compare refs: {"baseRef": "main", "headRef": "HEAD", "query": "changes"}
- Find breaking changes: {"baseRef": "main", "headRef": "HEAD", "query": "breaking"}
```

#### 16. refactor_rename_symbol
```
Examples:
- Preview rename: {"symbol": "oldName", "newName": "newName", "preview": true}
- Execute rename: {"symbol": "oldName", "newName": "newName"}
```

#### 17. generate_migration
```
Examples:
- Generate migration: {"name": "add_user_preferences", "changes": ["add column preferences to users"]}
```

#### 18. query_git_history
```
Examples:
- File history: {"query": "file", "file": "src/lambdas/RegisterUser/index.ts"}
- Symbol history: {"query": "symbol", "symbol": "handleRegisterUser"}
- Blame: {"query": "blame", "file": "src/lambdas/RegisterUser/index.ts"}
```

#### 19. analyze_pattern_consistency
```
Examples:
- Scan patterns: {"query": "scan"}
- Compare branches: {"query": "compare", "baseRef": "main", "headRef": "feature"}
```

#### 20. sync_conventions
```
Examples:
- Export conventions: {"query": "export"}
- Import conventions: {"query": "import", "source": "other-repo"}
- Diff conventions: {"query": "diff", "source": "other-repo"}
```

#### 21. refactor_extract_module
```
Examples:
- Analyze extraction: {"file": "src/utils.ts", "symbols": ["helperA", "helperB"], "mode": "analyze"}
- Preview extraction: {"file": "src/utils.ts", "symbols": ["helperA"], "targetModule": "src/helpers.ts", "mode": "preview"}
```

#### 22. refactor_inline_constant
```
Examples:
- Find candidates: {"file": "src/config.ts", "mode": "find"}
- Preview inline: {"file": "src/config.ts", "constant": "API_URL", "mode": "preview"}
```

#### 23. analyze_bundle_size
```
Examples:
- Analyze Lambda: {"lambda": "RegisterUser", "query": "summary"}
- Compare Lambdas: {"query": "compare"}
- Get optimization tips: {"lambda": "RegisterUser", "query": "optimize"}
```

#### 24. analyze_cold_start
```
Examples:
- Estimate cold start: {"lambda": "RegisterUser", "query": "estimate"}
- Compare Lambdas: {"query": "compare"}
- Get optimization tips: {"lambda": "RegisterUser", "query": "optimize"}
```

### Success Criteria

#### Automated Verification:
- [ ] Type checking passes: `pnpm run check:types`
- [ ] Linting passes: `pnpm run lint`
- [ ] Formatting passes: `pnpm run format:check`

#### Manual Verification:
- [ ] MCP server ListTools returns examples in descriptions
- [ ] Examples are valid JSON that would work with the tool

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Create Tool Registry

### Overview
Move tool definitions from inline in server.ts to a `src/mcp/tools/` directory with auto-registration.

### New Directory Structure

```
src/mcp/tools/
├── index.ts                    # Registry with auto-loader
├── types.ts                    # ToolDefinition interface
├── data-queries/
│   ├── index.ts                # Re-exports
│   ├── query-entities.ts       # Tool definition + handler reference
│   ├── query-lambda.ts
│   ├── query-infrastructure.ts
│   ├── query-dependencies.ts
│   └── query-conventions.ts
├── validation/
│   ├── index.ts
│   ├── validate-pattern.ts
│   ├── check-coverage.ts
│   ├── lambda-impact.ts
│   ├── suggest-tests.ts
│   ├── check-type-alignment.ts
│   ├── validate-naming.ts
│   ├── index-codebase.ts
│   └── search-codebase-semantics.ts
├── refactoring/
│   ├── index.ts
│   ├── apply-convention.ts
│   ├── rename-symbol.ts
│   ├── extract-module.ts
│   ├── inline-constant.ts
│   └── generate-migration.ts
├── git/
│   ├── index.ts
│   ├── semantic-diff.ts
│   ├── query-git-history.ts
│   ├── analyze-pattern-consistency.ts
│   └── sync-conventions.ts
├── performance/
│   ├── index.ts
│   ├── analyze-bundle-size.ts
│   └── analyze-cold-start.ts
└── cross-repo/
    ├── index.ts
    └── check-schema-drift.ts
```

### Changes Required

#### 1. Create types.ts
**New File**: `src/mcp/tools/types.ts`

```typescript
import type {McpResponse} from '../handlers/shared/response-types.js'

/**
 * MCP Tool Definition with handler reference
 */
export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  handler: (args: Record<string, unknown>) => Promise<McpResponse>
}
```

#### 2. Create tool definition files
Each tool file exports a `ToolDefinition`:

**Example**: `src/mcp/tools/data-queries/query-entities.ts`
```typescript
import type {ToolDefinition} from '../types.js'
import {handleEntityQuery} from '../../handlers/entities.js'

export const queryEntitiesTool: ToolDefinition = {
  name: 'query_entities',
  description: `Query entity schemas and relationships (uses Drizzle ORM with Aurora DSQL).

Examples:
- List all entities: {"query": "schema"}
- Get specific entity: {"entity": "Users", "query": "schema"}
- Get relationships: {"query": "relationships"}`,
  inputSchema: {
    type: 'object',
    properties: {
      entity: {
        type: 'string',
        description: 'Entity name',
        enum: ['Users', 'Files', 'Devices', 'UserFiles', 'UserDevices']
      },
      query: {
        type: 'string',
        description: 'Query type',
        enum: ['schema', 'relationships', 'collections']
      }
    },
    required: ['query']
  },
  handler: handleEntityQuery
}
```

#### 3. Create category index files
**Example**: `src/mcp/tools/data-queries/index.ts`
```typescript
export {queryEntitiesTool} from './query-entities.js'
export {queryLambdaTool} from './query-lambda.js'
export {queryInfrastructureTool} from './query-infrastructure.js'
export {queryDependenciesTool} from './query-dependencies.js'
export {queryConventionsTool} from './query-conventions.js'
```

#### 4. Create main registry
**New File**: `src/mcp/tools/index.ts`

```typescript
import type {ToolDefinition} from './types.js'

// Import all tools
import {queryEntitiesTool, queryLambdaTool, ...} from './data-queries/index.js'
import {validatePatternTool, ...} from './validation/index.js'
import {applyConventionTool, ...} from './refactoring/index.js'
import {semanticDiffTool, ...} from './git/index.js'
import {analyzeBundleSizeTool, ...} from './performance/index.js'
import {checkSchemaDriftTool} from './cross-repo/index.js'

/**
 * All registered MCP tools
 */
export const tools: ToolDefinition[] = [
  // Data queries
  queryEntitiesTool,
  queryLambdaTool,
  queryInfrastructureTool,
  queryDependenciesTool,
  queryConventionsTool,

  // Validation
  validatePatternTool,
  checkCoverageTool,
  lambdaImpactTool,
  suggestTestsTool,
  checkTypeAlignmentTool,
  validateNamingTool,
  indexCodebaseTool,
  searchCodebaseSemanticsTool,

  // Refactoring
  applyConventionTool,
  renameSymbolTool,
  extractModuleTool,
  inlineConstantTool,
  generateMigrationTool,

  // Git
  semanticDiffTool,
  queryGitHistoryTool,
  analyzePatternConsistencyTool,
  syncConventionsTool,

  // Performance
  analyzeBundleSizeTool,
  analyzeColdStartTool,

  // Cross-repo
  checkSchemaDriftTool,
]

/**
 * Get tool by name
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return tools.find(t => t.name === name)
}

/**
 * Get tool definitions for MCP ListTools
 */
export function getToolDefinitions() {
  return tools.map(({name, description, inputSchema}) => ({
    name,
    description,
    inputSchema
  }))
}

export type {ToolDefinition}
```

#### 5. Update server.ts
**File**: `src/mcp/server.ts`
**Changes**: Replace inline definitions and switch with registry

```typescript
import {Server} from '@modelcontextprotocol/sdk/server/index.js'
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js'
import {CallToolRequestSchema, ListToolsRequestSchema} from '@modelcontextprotocol/sdk/types.js'
import {tools, getToolByName, getToolDefinitions} from './tools/index.js'

const server = new Server(
  {name: 'media-downloader-mcp', version: '1.0.0'},
  {capabilities: {tools: {}}}
)

// List all available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {tools: getToolDefinitions()}
})

// Handle tool calls via registry
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const {name, arguments: args = {}} = request.params
  const tool = getToolByName(name)

  if (!tool) {
    return {content: [{type: 'text', text: `Error: Unknown tool: ${name}`}], isError: true}
  }

  try {
    return await tool.handler(args)
  } catch (error) {
    return {content: [{type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}`}], isError: true}
  }
})

// Start server
const transport = new StdioServerTransport()
await server.connect(transport)
```

### Success Criteria

#### Automated Verification:
- [ ] Type checking passes: `pnpm run check:types`
- [ ] Test types pass: `pnpm run check:test:types`
- [ ] Linting passes: `pnpm run lint`
- [ ] Formatting passes: `pnpm run format:check`
- [ ] Unit tests pass: `pnpm test`
- [ ] Dependency rules pass: `pnpm run deps:check`

#### Manual Verification:
- [ ] MCP server starts without errors
- [ ] All 24 tools are listed by ListTools
- [ ] Each tool functions correctly
- [ ] Adding a new tool only requires creating one file

**Implementation Note**: This completes the Priority 1 improvements. Phase complete.

---

## Testing Strategy

### Unit Tests
- Existing tests should continue passing
- No new tests required (behavior unchanged)

### Integration Tests
- MCP server startup
- ListTools returns all 24 tools
- CallTool routes correctly to handlers

### Manual Testing
After each phase:
1. Start MCP server: `pnpm run mcp:start`
2. Test tool listing
3. Test at least one tool from each category

## Performance Considerations

- No performance impact expected (reorganization only)
- Lazy loading maintained in handlers
- No additional runtime dependencies

## Migration Notes

- No database migrations required
- No user-facing changes
- Backwards compatible with existing MCP clients

## References

- Original evaluation: `/tmp/mcp-eval.md` (recovered from git history)
- Response types: `src/mcp/handlers/shared/response-types.ts`
- Current server: `src/mcp/server.ts`
