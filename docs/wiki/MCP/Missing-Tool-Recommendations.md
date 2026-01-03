# Missing MCP Tool Recommendations

This document identifies gaps in the current MCP server tooling and recommends new tools or enhancements based on the audit findings.

**Assessment Date**: 2026-01-03
**Audit Reference**: [Spec-Compliance-Assessment.md](./Spec-Compliance-Assessment.md)

## Recommended New Tools

### 1. validate_file_paths

**Purpose**: Validate and sanitize file paths before use in other tools
**Priority**: HIGH (security)
**Category**: Validation

**Rationale**:
Currently, no explicit path traversal protection exists. File path parameters are passed directly to filesystem operations without validation.

**Proposed Schema**:
```typescript
{
  name: 'validate_file_paths',
  description: 'Validate and sanitize file paths for security',
  inputSchema: {
    type: 'object',
    properties: {
      paths: {type: 'array', items: {type: 'string'}, description: 'File paths to validate'},
      allowedRoots: {type: 'array', items: {type: 'string'}, description: 'Allowed root directories'}
    },
    required: ['paths']
  }
}
```

**Expected Behavior**:
- Reject paths containing `..` traversal
- Normalize paths to absolute form
- Validate paths are within allowed project directories
- Return sanitized paths or validation errors

---

### 2. query_test_coverage

**Purpose**: Query test coverage metrics per file or Lambda function
**Priority**: MEDIUM
**Category**: Analysis

**Rationale**:
The current `check_coverage` tool analyzes mock requirements but doesn't provide actual test coverage metrics. Coverage data must be obtained via external tools.

**Proposed Schema**:
```typescript
{
  name: 'query_test_coverage',
  description: 'Query test coverage metrics from Vitest coverage reports',
  inputSchema: {
    type: 'object',
    properties: {
      target: {type: 'string', description: 'File or Lambda to check coverage for'},
      query: {
        type: 'string',
        enum: ['summary', 'lines', 'branches', 'functions', 'uncovered'],
        description: 'Coverage query type'
      },
      threshold: {type: 'number', description: 'Minimum coverage percentage threshold'}
    },
    required: ['query']
  }
}
```

**Implementation Notes**:
- Parse `coverage/coverage-summary.json` from Vitest
- Support filtering by file path patterns
- Highlight uncovered lines for targeted improvements

---

### 3. generate_handler_scaffold

**Purpose**: Generate Lambda handler boilerplate following project conventions
**Priority**: LOW
**Category**: Refactoring

**Rationale**:
New Lambda handlers require significant boilerplate including imports, types, response helpers, and test files. Automation reduces setup time and ensures convention compliance.

**Proposed Schema**:
```typescript
{
  name: 'generate_handler_scaffold',
  description: 'Generate Lambda handler boilerplate with test file',
  inputSchema: {
    type: 'object',
    properties: {
      name: {type: 'string', description: 'Lambda function name (PascalCase)'},
      trigger: {
        type: 'string',
        enum: ['api-gateway', 'sqs', 's3', 'eventbridge', 'schedule'],
        description: 'Event trigger type'
      },
      entities: {type: 'array', items: {type: 'string'}, description: 'Entities to include'},
      dryRun: {type: 'boolean', description: 'Preview without creating files'}
    },
    required: ['name', 'trigger']
  }
}
```

**Generated Files**:
- `src/lambdas/{name}/src/index.ts` - Handler with appropriate event types
- `src/lambdas/{name}/test/index.test.ts` - Test scaffold with mocks
- Updates to `graphrag/metadata.json` for discovery

---

### 4. analyze_api_contracts

**Purpose**: Validate Lambda handlers match TypeSpec API definitions
**Priority**: MEDIUM
**Category**: Validation

**Rationale**:
The project uses TypeSpec for API documentation but lacks automated validation that handlers return the correct response shapes.

**Proposed Schema**:
```typescript
{
  name: 'analyze_api_contracts',
  description: 'Validate Lambda handlers match TypeSpec API contracts',
  inputSchema: {
    type: 'object',
    properties: {
      lambda: {type: 'string', description: 'Lambda to validate'},
      query: {
        type: 'string',
        enum: ['check', 'list', 'diff'],
        description: 'Validation type'
      }
    },
    required: ['query']
  }
}
```

---

### 5. query_security_audit

**Purpose**: Audit code for common security issues
**Priority**: MEDIUM
**Category**: Validation

**Rationale**:
Beyond convention validation, explicit security auditing for OWASP top 10 issues would strengthen the codebase.

**Proposed Schema**:
```typescript
{
  name: 'query_security_audit',
  description: 'Audit code for security vulnerabilities',
  inputSchema: {
    type: 'object',
    properties: {
      scope: {type: 'array', items: {type: 'string'}, description: 'Files/directories to audit'},
      checks: {
        type: 'array',
        items: {type: 'string'},
        description: 'Specific checks to run: injection, xss, auth, secrets'
      }
    },
    required: ['scope']
  }
}
```

---

## Tool Enhancements

### apply_convention

**Current State**: Detection only - `dryRun` effectively always true
**Enhancement**: Add actual auto-fix capability
**Complexity**: HIGH
**Impact**: HIGH

**Proposed Changes**:
1. Implement AST transformations using ts-morph
2. Add rollback capability for failed fixes
3. Support selective fixes per file/rule
4. Add `--fix` mode to validation scripts

**Example Enhanced Behavior**:
```typescript
// Input
return {statusCode: 200, body: JSON.stringify(data)}

// Auto-fixed output
return response(200, data)
```

---

### search_codebase_semantics

**Current State**: Basic semantic search with LanceDB
**Enhancement**: Add filtering by file type, date range, and symbol type
**Complexity**: LOW
**Impact**: MEDIUM

**Proposed Additional Parameters**:
```typescript
{
  fileTypes: {type: 'array', items: {type: 'string'}, description: 'Filter by extension: ts, tsx, json'},
  symbolType: {type: 'string', enum: ['function', 'class', 'type', 'all'], description: 'Symbol type filter'},
  modifiedAfter: {type: 'string', description: 'ISO date for filtering by modification time'}
}
```

---

### validate_pattern

**Current State**: 19 rules with file-level validation
**Enhancement**: Add project-level validation and batch reporting
**Complexity**: MEDIUM
**Impact**: MEDIUM

**Proposed Additions**:
1. `query: 'project'` - Validate entire project with aggregated report
2. `query: 'ci'` - Output in CI-friendly format (JSON, JUnit XML)
3. `query: 'fix'` - Auto-fix violations where possible (ties to apply_convention enhancement)

---

### diff_semantic

**Current State**: Breaking change detection between git refs
**Enhancement**: Add PR review integration
**Complexity**: MEDIUM
**Impact**: MEDIUM

**Proposed Additions**:
1. `query: 'review'` - Generate PR-ready review comments
2. `query: 'changelog'` - Generate changelog entries from changes
3. GitHub/GitLab webhook integration for automatic reviews

---

## Implementation Priority Matrix

| Tool/Enhancement | Priority | Effort | Security Impact | Developer Experience |
|-----------------|----------|--------|-----------------|---------------------|
| validate_file_paths | HIGH | LOW | HIGH | LOW |
| apply_convention (fix) | HIGH | HIGH | LOW | HIGH |
| query_test_coverage | MEDIUM | MEDIUM | LOW | HIGH |
| search_codebase_semantics (filters) | LOW | LOW | LOW | MEDIUM |
| generate_handler_scaffold | LOW | MEDIUM | LOW | HIGH |
| analyze_api_contracts | MEDIUM | MEDIUM | LOW | MEDIUM |
| query_security_audit | MEDIUM | HIGH | HIGH | MEDIUM |

## Recommended Implementation Order

1. **Immediate** (Security): `validate_file_paths` - Add path sanitization
2. **Short-term** (Developer Experience): Enhance `apply_convention` with auto-fix
3. **Medium-term** (Quality): Add `query_test_coverage` and `analyze_api_contracts`
4. **Long-term** (Automation): Add `generate_handler_scaffold` and security auditing

## References

- [Tool Capability Matrix](./Tool-Capability-Matrix.md)
- [Spec Compliance Assessment](./Spec-Compliance-Assessment.md)
- MCP 2025-11-25 Specification
