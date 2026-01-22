# MCP Convention Tools

## Quick Reference
- **When to use**: AI assistants querying project conventions and validating code
- **Enforcement**: Automated via MCP server and optional CI integration
- **Impact if violated**: Varies by rule severity (CRITICAL to LOW)

## Overview

The MCP server provides 5 tools for convention querying and code validation:

| Tool | Purpose | Primary Use Case |
|------|---------|-----------------|
| `query_conventions` | Search project conventions | Understanding rules before coding |
| `validate_pattern` | AST-based code validation | Checking code against conventions |
| `apply_convention` | Auto-fix convention violations | Automated refactoring |
| `check_coverage` | Mock analysis for tests | Identifying required Vitest mocks |
| `lambda_impact` | Dependency impact analysis | Understanding change scope |
| `suggest_tests` | Test scaffolding generation | Creating new test files |

## Tool Details

### query_conventions

Search and filter project conventions from `docs/wiki/Meta/Conventions-Tracking.md` and wiki pages.

**Query Types:**
- `list` - List all conventions grouped by severity
- `search` - Full-text search across conventions and wiki
- `category` - Filter by category (testing, aws, typescript, etc.)
- `enforcement` - Filter by severity (CRITICAL, HIGH, MEDIUM, LOW)
- `detail` - Get full details for a specific convention
- `wiki` - List or search wiki documentation

**Examples:**
```typescript
// Find all testing conventions
query_conventions({ query: "category", category: "testing" })

// Search for mock-related conventions
query_conventions({ query: "search", term: "mock" })

// Get CRITICAL rules that must not be violated
query_conventions({ query: "enforcement", severity: "CRITICAL" })
```

### validate_pattern

Validate TypeScript files against project conventions using AST analysis (ts-morph).

**Query Types:**
- `rules` - List all available validation rules
- `all` - Run all applicable validations on a file
- `summary` - Concise validation summary
- **CRITICAL Rules:**
  - `aws-sdk` - Check AWS SDK encapsulation
  - `entity` - Check entity mocking patterns
  - `config` - Check for configuration drift
  - `env` - Check environment variable validation
  - `cascade` - Check cascade deletion safety
- **HIGH Rules:**
  - `response` - Check response helper usage
  - `types` - Check exported type location
  - `batch` - Check batch operation retry handling
  - `scan` - Check scan pagination handling
- **HIGH Rules (documentation):**
  - `docs` - Check documentation sync with codebase
- **MEDIUM Rules:**
  - `imports` - Check import ordering
  - `enum` - Check ResponseStatus enum usage
  - `mock` - Check mock formatting patterns

**Validation Rules:**

| Rule | Alias | Severity | Description |
|------|-------|----------|-------------|
| aws-sdk-encapsulation | aws-sdk | CRITICAL | No direct AWS SDK imports outside src/lib/vendor/AWS/ |
| entity-mocking | entity | CRITICAL | Test files must use createEntityMock() for Drizzle entities |
| config-enforcement | config | CRITICAL | Detects configuration drift (for example, ESLint allowing underscore vars) |
| env-validation | env | CRITICAL | Raw process.env access must use getRequiredEnv() wrapper |
| cascade-safety | cascade | CRITICAL | Promise.all with delete operations must use Promise.allSettled |
| response-helpers | response | HIGH | Lambda handlers must use response() helper |
| types-location | types | HIGH | Exported types must be in src/types/ directory |
| batch-retry | batch | HIGH | Batch operations must use retryUnprocessed() wrapper |
| scan-pagination | scan | HIGH | Scan operations must use scanAllPages() wrapper |
| import-order | imports | MEDIUM | Imports grouped: node → aws-lambda → external → entities → vendor → types → utilities → relative |
| response-enum | enum | MEDIUM | Use ResponseStatus enum instead of magic strings |
| mock-formatting | mock | MEDIUM | Sequential mock returns should be separate statements |
| doc-sync | docs | HIGH | Documentation stays in sync with codebase |
| naming-conventions | naming | HIGH | Type and enum naming patterns |
| authenticated-handler-enforcement | auth | HIGH | Manual auth checks in handlers |
| comment-conventions | comments | HIGH | Lambda file headers, JSDoc, @example length |
| docs-structure | docs-location | HIGH | Documentation directory conventions |
| powertools-metrics | metrics | MEDIUM | PowerTools metrics usage patterns |

**Examples:**
```typescript
// Full validation of a Lambda handler
validate_pattern({ file: "src/lambdas/ListFiles/src/index.ts", query: "all" })

// Check only AWS SDK encapsulation
validate_pattern({ file: "src/lambdas/ListFiles/src/index.ts", query: "aws-sdk" })

// List all available rules
validate_pattern({ query: "rules" })
```

### check_coverage

Analyze which dependencies need mocking for Vitest tests using build/graph.json.

**Query Types:**
- `required` - List all dependencies that need mocking
- `missing` - Compare required mocks to existing test file
- `all` - Full analysis with categorization
- `summary` - Quick summary of mock requirements

**Dependency Categories:**
- **Entities**: Drizzle query functions (use createEntityMock)
- **Vendors**: AWS SDK wrappers (lib/vendor/AWS/*)
- **Utilities**: Shared helpers (util/*)
- **External**: Third-party packages

**Examples:**
```typescript
// Get all mocks needed for a Lambda
check_coverage({ file: "src/lambdas/ListFiles/src/index.ts", query: "required" })

// Find missing mocks in existing test
check_coverage({ file: "src/lambdas/ListFiles/src/index.ts", query: "missing" })
```

### lambda_impact

Show what's affected by changing a file - dependents, tests, and infrastructure.

**Query Types:**
- `dependents` - Direct files that import this file
- `cascade` - Full transitive dependency cascade
- `tests` - Test files that need updating
- `infrastructure` - Terraform files that may be affected
- `all` - Comprehensive impact analysis

**Examples:**
```typescript
// See what's affected by changing an entity
lambda_impact({ file: "src/entities/Files.ts", query: "cascade" })

// Find tests that need updating
lambda_impact({ file: "src/util/lambda-helpers.ts", query: "tests" })

// Full impact analysis
lambda_impact({ file: "src/entities/Users.ts", query: "all" })
```

### suggest_tests

Generate test file scaffolding with all required mocks based on dependency analysis.

**Query Types:**
- `scaffold` - Complete test file with all mocks
- `mocks` - Just the mock setup section
- `fixtures` - Suggested test fixtures
- `structure` - Test structure outline (describe/it blocks)

**Examples:**
```typescript
// Generate complete test file
suggest_tests({ file: "src/lambdas/NewLambda/src/index.ts", query: "scaffold" })

// Get just the mock setup
suggest_tests({ file: "src/lambdas/NewLambda/src/index.ts", query: "mocks" })
```

### apply_convention

Automatically apply conventions to code files, reducing manual refactoring effort.

**Supported Conventions:**

| Convention | Effect | Status |
|------------|--------|--------|
| `aws-sdk-wrapper` | Replaces direct AWS SDK imports with vendor wrapper imports | Auto-fix |
| `entity-mock` | Generates correct entity mock setup for Drizzle queries | Guidance |
| `response-helper` | Suggests response helper replacements | Guidance |
| `env-validation` | Suggests getRequiredEnv() replacements | Guidance |
| `powertools` | Suggests withPowertools() wrapper usage | Guidance |
| `all` | Runs all applicable conventions | Mixed |

**Examples:**
```typescript
// Auto-fix AWS SDK imports
apply_convention({ file: "src/lambdas/MyLambda/src/index.ts", convention: "aws-sdk-wrapper" })

// Preview changes without applying (dry run)
apply_convention({ file: "src/lambdas/MyLambda/src/index.ts", convention: "all", dryRun: true })
```

**Output:**
- `dryRun: true` - Returns proposed changes without modifying files
- `dryRun: false` (default) - Applies changes and returns diff summary

## CI Integration

The validation rules in `src/mcp/validation/` are designed for reuse in CI pipelines:

```typescript
import { validateFile, allRules } from './src/mcp/validation/index.js'

// Validate a file
const result = await validateFile('src/lambdas/ListFiles/src/index.ts')

// Check for CRITICAL violations
const critical = result.violations.filter(v => v.severity === 'CRITICAL')
if (critical.length > 0) {
  process.exit(1)
}
```

## Architecture

```
src/mcp/
├── server.ts              # MCP server with tool definitions
├── README.md              # Tool documentation
├── handlers/
│   ├── conventions.ts     # query_conventions handler
│   ├── coverage.ts        # check_coverage handler
│   ├── validation.ts      # validate_pattern handler
│   ├── impact.ts          # lambda_impact handler
│   ├── test-scaffold.ts   # suggest_tests handler
│   └── data-loader.ts     # Shared data loading with caching
├── parsers/
│   └── convention-parser.ts  # Convention file parser
└── validation/
    ├── types.ts           # Shared validation types
    ├── index.ts           # Unified validation interface
    └── rules/
        ├── aws-sdk-encapsulation.ts  # CRITICAL
        ├── electrodb-mocking.ts      # CRITICAL
        ├── config-enforcement.ts     # CRITICAL
        ├── env-validation.ts         # CRITICAL
        ├── cascade-safety.ts         # CRITICAL
        ├── response-helpers.ts       # HIGH
        ├── types-location.ts         # HIGH
        ├── batch-retry.ts            # HIGH
        ├── scan-pagination.ts        # HIGH
        ├── doc-sync.ts               # HIGH (documentation)
        ├── import-order.ts           # MEDIUM
        ├── response-enum.ts          # MEDIUM
        └── mock-formatting.ts        # MEDIUM
```

---

## Response Helpers

Standard response formatting in `src/mcp/handlers/shared/response-types.ts`.

### Error Response

```typescript
return createErrorResponse('File not found', 'Check that the file path is correct')
```

### Success Response

```typescript
return createSuccessResponse({files: [...], count: 10})
```

### Text Response

```typescript
return createTextResponse('Operation completed successfully')
```

---

## Related Documentation

- [Dependency Graph Analysis](../Testing/Dependency-Graph-Analysis.md) - build/graph.json usage
- [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) - Mocking and entity testing patterns
- [SDK Encapsulation Policy](../Conventions/Vendor-Encapsulation-Policy.md) - AWS SDK rules

---

*Use these MCP tools to understand and validate code against project conventions before implementation.*
