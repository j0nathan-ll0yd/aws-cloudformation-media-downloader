# MCP Server Improvements Implementation Plan

## Overview

Implement Priority 1 improvements identified in PR #359 (MCP Server Evaluation - January 2026):
1. Standardize Response Formatting
2. Add Tool Usage Examples
3. Create Tool Registry with auto-registration

These improvements address response inconsistency, missing documentation, and maintainability issues in the MCP server.

## Current State Analysis

### Response Formatting
- **Existing helpers**: `src/mcp/handlers/shared/response-types.ts` provides `createErrorResponse()`, `createSuccessResponse()`, `createTextResponse()`
- **Partial adoption**: `entities.ts`, `lambda.ts`, `conventions.ts` use helpers correctly
- **Inconsistency**: `validation.ts` returns plain objects; `server.ts` has redundant `wrapResult()`
- **Problem**: `server.ts:64-66` duplicates `createSuccessResponse()` functionality

### Tool Definitions
- **Location**: All 24 tools defined inline in `server.ts:71-476` (~405 lines)
- **No examples**: Descriptions lack concrete usage examples
- **No registry**: Linear growth as tools are added

### Key Discoveries:
- `src/mcp/handlers/shared/response-types.ts:48-75` - Standardized helpers already exist
- `src/mcp/server.ts:64-66` - Redundant `wrapResult()` function
- `src/mcp/server.ts:483-561` - Switch statement routes 24 tools
- `src/mcp/handlers/validation.ts:31-58` - Returns plain objects instead of using helpers

## Desired End State

After implementation:
1. All handlers use `createSuccessResponse()` / `createErrorResponse()` consistently
2. No redundant `wrapResult()` in server.ts
3. Each tool has 1-2 usage examples in its definition
4. Tool definitions live in `src/mcp/tools/*.ts` with auto-registration
5. `server.ts` is reduced from ~650 to ~150 lines

### Verification:
- `pnpm run check:types` passes
- `pnpm run test` passes
- MCP server starts and responds to all 24 tools
- Tool list includes examples in descriptions

## What We're NOT Doing

- Tool versioning (Priority 3)
- Batch operation support (separate ticket)
- Cross-tool workflows (separate ticket)
- Security validation rules (Priority 2)
- Terraform validation rules (Priority 2)

---

## Phase 1: Standardize Response Formatting

### Overview
Remove redundant `wrapResult()` and ensure all handlers use shared response helpers.

### Changes Required:

#### 1. Remove `wrapResult()` from server.ts
**File**: `src/mcp/server.ts`
**Changes**: Delete redundant function and update call sites

```typescript
// DELETE lines 64-66:
// function wrapResult(result: unknown) {
//   return {content: [{type: 'text', text: JSON.stringify(result, null, 2)}]}
// }

// UPDATE switch cases that use wrapResult() to pass through directly:
// Before:
case 'query_conventions':
  return wrapResult(await handleConventionsQuery(args as unknown as ConventionQueryArgs))

// After:
case 'query_conventions':
  return await handleConventionsQuery(args as unknown as ConventionQueryArgs)
```

#### 2. Update validation.ts to use response helpers
**File**: `src/mcp/handlers/validation.ts`
**Changes**: Wrap plain object returns with `createSuccessResponse()`

```typescript
// Before (line 31-40):
case 'rules': {
  return {
    rules: allRules.map((rule) => ({...})),
    aliases: ...
  }
}

// After:
case 'rules': {
  return createSuccessResponse({
    rules: allRules.map((rule) => ({...})),
    aliases: ...
  })
}
```

Similar changes needed for:
- `validation.ts:51-58` (case 'all')
- `validation.ts:69-78` (case 'aws-sdk')
- `validation.ts:86-94` (case 'cicd')

#### 3. Audit all handlers for consistency
**Files**: All files in `src/mcp/handlers/`
**Changes**: Ensure every return uses `createSuccessResponse()`, `createErrorResponse()`, or `createTextResponse()`

Handlers to audit:
- `apply-convention.ts`
- `coverage.ts`
- `impact.ts`
- `test-scaffold.ts`
- `naming.ts`
- `semantics.ts`
- `git/semantic-diff.ts`
- `git/history-query.ts`
- `refactoring/rename-symbol.ts`
- `refactoring/extract-module.ts`
- `refactoring/inline-constant.ts`
- `migrations/generator.ts`
- `cross-repo/pattern-consistency.ts`
- `cross-repo/convention-sync.ts`
- `cross-repo/schema-drift.ts`
- `performance/bundle-size.ts`
- `performance/cold-start.ts`

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm run check:types` passes
- [ ] `pnpm run test` passes
- [ ] `grep -r "wrapResult" src/mcp/` returns no results
- [ ] All handlers import from `./shared/response-types.js`

#### Manual Verification:
- [ ] MCP server starts: `node build/mcp/server.mjs`
- [ ] Sample tool call returns properly formatted response

---

## Phase 2: Add Tool Usage Examples

### Overview
Add concrete usage examples to each tool definition to improve discoverability.

### Changes Required:

#### 1. Update tool definitions with examples
**File**: `src/mcp/server.ts`
**Changes**: Add examples to each tool's description or as separate field

```typescript
// Before:
{
  name: 'query_entities',
  description: 'Query entity schemas and relationships (uses Drizzle ORM with Aurora DSQL)',
  inputSchema: {...}
}

// After:
{
  name: 'query_entities',
  description: `Query entity schemas and relationships (uses Drizzle ORM with Aurora DSQL).

Examples:
- List all entities: {"query": "list"}
- Get schema for Users: {"entity": "Users", "query": "schema"}
- Get relationships: {"query": "relationships"}`,
  inputSchema: {...}
}
```

#### 2. Examples for all 24 tools

| Tool | Example 1 | Example 2 |
|------|-----------|-----------|
| query_entities | `{"query": "list"}` | `{"entity": "Users", "query": "schema"}` |
| query_lambda | `{"query": "list"}` | `{"lambda": "ListFiles", "query": "config"}` |
| query_infrastructure | `{"resource": "s3", "query": "config"}` | `{"resource": "all", "query": "usage"}` |
| query_dependencies | `{"query": "circular"}` | `{"file": "src/lambdas/ListFiles/src/index.ts", "query": "imports"}` |
| query_conventions | `{"query": "list"}` | `{"query": "search", "term": "mock"}` |
| validate_pattern | `{"query": "rules"}` | `{"file": "src/lambdas/ListFiles/src/index.ts", "query": "all"}` |
| check_coverage | `{"file": "src/lambdas/ListFiles/src/index.ts", "query": "required"}` | `{"file": "...", "query": "missing"}` |
| lambda_impact | `{"file": "src/entities/Users.ts", "query": "all"}` | `{"file": "...", "query": "cascade"}` |
| suggest_tests | `{"file": "src/lambdas/NewLambda/src/index.ts", "query": "scaffold"}` | `{"file": "...", "query": "mocks"}` |
| check_type_alignment | `{"query": "all"}` | `{"typeName": "User", "query": "check"}` |
| validate_naming | `{"query": "all"}` | `{"file": "src/types/api.ts", "query": "validate"}` |
| index_codebase | `{}` | - |
| search_codebase_semantics | `{"query": "how to handle authentication"}` | `{"query": "S3 upload", "limit": 10}` |
| apply_convention | `{"file": "...", "convention": "all", "dryRun": true}` | `{"file": "...", "convention": "aws-sdk-wrapper"}` |
| diff_semantic | `{"query": "breaking"}` | `{"query": "impact", "baseRef": "main"}` |
| refactor_rename_symbol | `{"query": "preview", "symbol": "oldName"}` | `{"query": "execute", "symbol": "old", "newName": "new"}` |
| generate_migration | `{"query": "plan"}` | `{"query": "script", "convention": "aws-sdk"}` |
| query_git_history | `{"query": "file", "target": "src/mcp/server.ts"}` | `{"query": "symbol", "target": "server.ts:handleEntityQuery"}` |
| analyze_pattern_consistency | `{"query": "drift"}` | `{"query": "scan", "pattern": "error-handling"}` |
| sync_conventions | `{"query": "export", "format": "json"}` | `{"query": "diff", "source": "..."}` |
| refactor_extract_module | `{"query": "analyze", "sourceFile": "...", "targetModule": "..."}` | - |
| refactor_inline_constant | `{"query": "find"}` | `{"query": "preview", "constant": "MY_CONST"}` |
| analyze_bundle_size | `{"query": "summary"}` | `{"query": "optimize", "lambda": "ListFiles"}` |
| analyze_cold_start | `{"query": "estimate", "lambda": "ListFiles"}` | `{"query": "optimize"}` |
| check_schema_drift | `{"query": "check"}` | `{"query": "columns", "table": "users"}` |

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm run check:types` passes
- [ ] `pnpm run test` passes
- [ ] All 24 tools have "Examples:" in description

#### Manual Verification:
- [ ] MCP tool list shows examples in descriptions
- [ ] Examples are copy-pasteable and work correctly

---

## Phase 3: Create Tool Registry

### Overview
Extract tool definitions to separate files with auto-registration to improve maintainability.

### Changes Required:

#### 1. Create tool definition structure
**New Directory**: `src/mcp/tools/`

```
src/mcp/tools/
├── index.ts              # Registry and auto-loader
├── types.ts              # Shared tool definition types
├── data-queries/
│   ├── query-entities.ts
│   ├── query-lambda.ts
│   ├── query-infrastructure.ts
│   └── query-dependencies.ts
├── validation/
│   ├── validate-pattern.ts
│   ├── check-coverage.ts
│   ├── check-type-alignment.ts
│   └── validate-naming.ts
├── refactoring/
│   ├── apply-convention.ts
│   ├── rename-symbol.ts
│   ├── extract-module.ts
│   └── inline-constant.ts
├── git/
│   ├── diff-semantic.ts
│   ├── query-git-history.ts
│   └── analyze-pattern-consistency.ts
├── performance/
│   ├── analyze-bundle-size.ts
│   └── analyze-cold-start.ts
└── cross-repo/
    ├── sync-conventions.ts
    └── check-schema-drift.ts
```

#### 2. Create tool definition type
**File**: `src/mcp/tools/types.ts`

```typescript
import type {McpResponse} from '../handlers/shared/response-types.js'

export interface ToolDefinition<TArgs = unknown> {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  handler: (args: TArgs) => Promise<McpResponse>
}

export function defineTool<TArgs>(tool: ToolDefinition<TArgs>): ToolDefinition<TArgs> {
  return tool
}
```

#### 3. Create example tool file
**File**: `src/mcp/tools/data-queries/query-entities.ts`

```typescript
import {defineTool} from '../types.js'
import {handleEntityQuery} from '../../handlers/entities.js'

export const queryEntitiesTool = defineTool({
  name: 'query_entities',
  description: `Query entity schemas and relationships (uses Drizzle ORM with Aurora DSQL).

Examples:
- List all entities: {"query": "list"}
- Get schema for Users: {"entity": "Users", "query": "schema"}
- Get relationships: {"query": "relationships"}`,
  inputSchema: {
    type: 'object',
    properties: {
      entity: {
        type: 'string',
        description: 'Entity name (Users, Files, Devices, UserFiles, UserDevices)',
        enum: ['Users', 'Files', 'Devices', 'UserFiles', 'UserDevices']
      },
      query: {
        type: 'string',
        description: 'Query type (schema, relationships, collections)',
        enum: ['schema', 'relationships', 'collections']
      }
    },
    required: ['query']
  },
  handler: handleEntityQuery
})
```

#### 4. Create registry/auto-loader
**File**: `src/mcp/tools/index.ts`

```typescript
import type {ToolDefinition} from './types.js'

// Import all tools
import {queryEntitiesTool} from './data-queries/query-entities.js'
import {queryLambdaTool} from './data-queries/query-lambda.js'
// ... import all other tools

// Export registry
export const toolRegistry: ToolDefinition[] = [
  queryEntitiesTool,
  queryLambdaTool,
  // ... all other tools
]

// Helper to get tool by name
export function getToolByName(name: string): ToolDefinition | undefined {
  return toolRegistry.find(t => t.name === name)
}

// Helper to get all tool definitions for ListTools
export function getAllToolDefinitions() {
  return toolRegistry.map(({name, description, inputSchema}) => ({
    name,
    description,
    inputSchema
  }))
}
```

#### 5. Update server.ts to use registry
**File**: `src/mcp/server.ts`

```typescript
// Before: 650 lines with inline definitions
// After: ~100 lines

import {Server} from '@modelcontextprotocol/sdk/server/index.js'
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js'
import {CallToolRequestSchema, ListToolsRequestSchema} from '@modelcontextprotocol/sdk/types.js'
import {getAllToolDefinitions, getToolByName} from './tools/index.js'

const server = new Server(
  {name: 'media-downloader-mcp', version: '1.0.0'},
  {capabilities: {tools: {}}}
)

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {tools: getAllToolDefinitions()}
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const {name, arguments: args} = request.params
  const tool = getToolByName(name)

  if (!tool) {
    return {
      content: [{type: 'text', text: `Error: Unknown tool: ${name}`}],
      isError: true
    }
  }

  try {
    return await tool.handler(args)
  } catch (error) {
    return {
      content: [{type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}`}],
      isError: true
    }
  }
})

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('MCP Server running on stdio')
}

main().catch(console.error)
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm run check:types` passes
- [ ] `pnpm run test` passes
- [ ] `server.ts` is < 150 lines
- [ ] All 24 tools are registered and callable
- [ ] `ls src/mcp/tools/**/*.ts | wc -l` shows expected file count

#### Manual Verification:
- [ ] MCP server starts successfully
- [ ] All tools respond correctly
- [ ] Adding a new tool only requires one file + one import

---

## Testing Strategy

### Unit Tests:
- Test each tool definition exports correctly
- Test registry finds tools by name
- Test response helpers produce valid MCP responses

### Integration Tests:
- Test MCP server starts and lists all 24 tools
- Test each tool category with sample inputs
- Test error responses have `isError: true`

### Manual Testing Steps:
1. Start MCP server: `node build/mcp/server.mjs`
2. Call `tools/list` and verify 24 tools with examples
3. Call each tool category (data-queries, validation, refactoring, etc.)
4. Verify error responses are formatted correctly

## Migration Notes

- No database changes required
- No breaking changes to MCP protocol
- Handlers remain unchanged; only their invocation changes
- Can be done incrementally (Phase 1 independent of Phase 2/3)

## References

- Original ticket: PR #359 (MCP Server Evaluation)
- MCP Response Spec: `src/mcp/handlers/shared/response-types.ts`
- Current server: `src/mcp/server.ts`
- Evaluation document: `docs/wiki/Evaluations/MCP-Server-Evaluation-2026-01.md`
