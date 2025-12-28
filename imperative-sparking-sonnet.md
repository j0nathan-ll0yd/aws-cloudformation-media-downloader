# Agentic Workflow Design for Development Tasks

## Overview

Design document for 7 agentic workflows that leverage existing codebase infrastructure:
- MCP server with 15 tools (query, validate, scaffold, apply conventions)
- 18 AST-based validation rules (5 CRITICAL, 9 HIGH, 4 MEDIUM)
- Test scaffolding with transitive dependency detection
- TypeSpec → Zod code generation
- Dependency graph (`build/graph.json`) for impact analysis

---

## Workflow Catalog

### 1. Test Gap Analysis
**Trigger**: `/analyze-tests` or coverage drop
**Steps**:
1. Scan all Lambdas for test files
2. Analyze existing tests for mock coverage (`check_coverage`)
3. Identify untested code paths
4. Generate prioritized test suggestions (`suggest_tests`)
5. Output markdown report with actions

**Quality Gates**: All Lambdas have test files, all transitive dependencies mocked
**Human Checkpoint**: Approve test generation priority
**Risk**: LOW (analysis only)

---

### 2. Lambda Scaffolding
**Trigger**: `/create-lambda <name> <trigger-type>`
**Steps**:
1. Parse requirements and query similar patterns (`query_lambda`)
2. Create directory structure: `src/lambdas/[Name]/{src,test}/`
3. Generate handler from trigger-type template
4. Generate test file via `scaffold:test`
5. Create Terraform configuration
6. Update `graphrag/metadata.json`
7. Apply conventions and validate

**Templates**: API Gateway (auth/optional), S3 Event, SQS, CloudWatch Schedule, Lambda Invoke
**Human Checkpoint**: Approve name and trigger type
**Risk**: LOW (new files only)

---

### 3. Documentation Update Automation
**Trigger**: PR merged or `/sync-docs`
**Steps**:
1. Detect gaps via `validate_pattern` (doc-sync rule)
2. Scan for new Lambdas/Entities vs metadata
3. Generate missing documentation from TSDoc
4. Update wiki pages and metadata.json
5. Regenerate GraphRAG (`pnpm run graphrag:extract`)

**Quality Gates**: All markdown in docs/wiki/, no orphaned references
**Human Checkpoint**: Approve AGENTS.md changes
**Risk**: LOW (documentation only)

---

### 4. Breaking Change Detection
**Trigger**: Entity/TypeSpec modified or `/check-breaking`
**Steps**:
1. Identify schema/API file changes
2. Compare entity schemas via AST
3. Classify breaking vs non-breaking
4. Calculate consumer impact (`lambda_impact`)
5. Check iOS app compatibility
6. Generate migration strategy

**Breaking**: Required field added, field removed, type changed, enum value removed
**Non-breaking**: Optional field added, enum value added
**Human Checkpoint**: Approve classification and migration
**Risk**: HIGH (data integrity implications)

---

### 5. Issue-to-Implementation (In-Worktree)
**Trigger**: `/implement-issue <url>` (assumes worktree already exists and active)
**Precondition**: Claude is operating from an existing worktree with feature branch
**Steps**:
1. Fetch issue details from Linear/GitHub
2. Query codebase for patterns (`search_codebase_semantics`)
3. Identify files to change (`query_dependencies`, `lambda_impact`)
4. **CHECKPOINT**: Approve implementation plan
5. Implement changes with validation
6. Generate/update tests via `suggest_tests`
7. Run full validation (`pnpm run validate:conventions`)
8. Run tests (`pnpm test`)
9. Commit with clean message (no AI attribution)

**Human Checkpoints**:
- Plan approval before implementation
- Test review before commit
**Risk**: MEDIUM (changes isolated in worktree)

---

### 6. Dependency Upgrade
**Trigger**: `/upgrade-deps [package]` or Dependabot PR
**Steps**:
1. Identify outdated packages (`pnpm outdated`)
2. Check security issues (`pnpm audit`)
3. Analyze breaking changes for major updates
4. Calculate impact via `query_dependencies`
5. **CHECKPOINT**: Approve upgrade scope
6. Update and install
7. Fix type errors, run tests
8. Build all Lambdas

**Special handling**: AWS SDK updates require vendor wrapper + webpack externals check
**Human Checkpoint**: Approve upgrade scope, review breaking change mitigations
**Risk**: MEDIUM-HIGH (type changes propagate)

---

### 7. Migration Assistant
**Trigger**: `/migrate <type>` (schema/dep/API)
**Steps**:
1. Identify migration type
2. Analyze current state (`query_entities`, `query_infrastructure`)
3. Calculate blast radius (`lambda_impact`)
4. Generate migration plan with checkpoints
5. **CHECKPOINT**: Approve plan
6. Apply changes in order
7. Update dependent code
8. Update tests
9. Run `pnpm run ci:local:full`

**Migration Types**: Schema (ElectroDB entity), Dependency (package version), API (TypeSpec contract)
**Human Checkpoints**: Plan approval, rollback checkpoint review, final approval
**Risk**: HIGH (data integrity, multi-Lambda impact)

---

## Tool Integration Strategy

### Leverage Existing MCP Handlers
| Workflow | Primary MCP Tools |
|----------|------------------|
| Test Gap | `check_coverage`, `suggest_tests` |
| Lambda Scaffold | `query_lambda`, `suggest_tests` |
| Docs Update | `validate_pattern` (doc-sync), `query_lambda` |
| Breaking Change | `lambda_impact`, `query_entities`, `compare_schemas` (new) |
| Issue-to-Impl | `search_codebase_semantics`, `query_dependencies`, `lambda_impact` |
| Dependency Upgrade | `query_dependencies` |
| Migration | `query_entities`, `query_infrastructure`, `lambda_impact` |

### New MCP Tools to Create
1. **execute_workflow** - Track multi-step workflow progress with checkpoints
2. **compare_schemas** - AST diff for entity/TypeSpec changes
3. **generate_changelog** - Parse commits for structured changelogs

### Integration Points
- `build/graph.json` - Dependency analysis for all workflows
- `graphrag/metadata.json` - Lambda metadata updates
- `docs/wiki/Meta/Conventions-Tracking.md` - Convention registry

---

## Quality Gates Summary

| Severity | Action | Applies To |
|----------|--------|-----------|
| CRITICAL | Block/fail | All workflows |
| HIGH | Require acknowledgment | Breaking Change, Migration |
| MEDIUM | Warn only | Documentation, Test Gap |

### Automated Checks (All Workflows)
- `pnpm run validate:conventions` - 18 AST rules
- `pnpm run ci:local` - Fast CI (~2-3 min)
- `pnpm run ci:local:full` - Full CI (~5-10 min)
- `pnpm run deps:check` - Architectural boundaries

---

## Human Checkpoints Summary

| Checkpoint Type | Workflows |
|-----------------|-----------|
| Plan approval | Issue-to-Impl, Migration |
| Scope approval | Dependency Upgrade |
| Classification review | Breaking Change |
| Name/type approval | Lambda Scaffold |
| Test review | Issue-to-Impl |

---

## Risk Assessment

| Risk Level | Workflows | Mitigation |
|------------|-----------|------------|
| LOW | Test Gap, Lambda Scaffold, Docs Update | Read-only or new files only |
| MEDIUM | Issue-to-Impl | Worktree isolation, staged commits |
| MEDIUM-HIGH | Dependency Upgrade | Type checking, full test suite |
| HIGH | Breaking Change, Migration | Human approval, rollback strategy |

### Rollback Strategies
- **Issue-to-Impl**: `git reset --hard HEAD~1` in worktree
- **Dependencies**: Restore package.json + lockfile from git
- **Migrations**: Staged commits enable partial rollback, ElectroDB versioning

---

## Implementation Approach

### Phase 1: Documentation
Create `docs/wiki/Automation/Agentic-Workflows.md` with:
- Complete workflow specifications
- Tool integration diagrams
- Quality gate definitions

### Phase 2: MCP Tool Extensions

#### New Handler: `src/mcp/handlers/workflow.ts`
Orchestration tool for multi-step workflows:
```typescript
// Tool: execute_workflow
interface WorkflowInput {
  workflow: 'test-gap' | 'lambda-scaffold' | 'docs-update' | 'breaking-change' |
            'implement-issue' | 'dependency-upgrade' | 'migration'
  target: string  // Issue URL, file path, package name, or scope
  options?: WorkflowOptions
}

// Coordinates existing tools in sequence with checkpoints
```

#### New Handler: `src/mcp/handlers/schema-diff.ts`
Compare entity/TypeSpec schemas for breaking changes:
```typescript
// Tool: compare_schemas
interface SchemaDiffInput {
  file: string
  base: string  // git ref to compare against (default: HEAD~1)
}

// Returns: { breaking: Change[], nonBreaking: Change[], migrationSuggestions: string[] }
```

#### New Handler: `src/mcp/handlers/changelog.ts`
Generate changelog from git commits:
```typescript
// Tool: generate_changelog
interface ChangelogInput {
  since: string  // git ref (tag, commit, date)
  format: 'markdown' | 'json'
  groupBy: 'type' | 'scope' | 'date'
}
```

#### Extend Existing: `src/mcp/handlers/test-scaffold.ts`
Add workflow integration:
- Accept workflow context for smarter generation
- Support batch scaffolding for multiple Lambdas

### Phase 3: Testing
- Unit tests for each new handler in `src/mcp/handlers/test/`
- Integration tests for workflow orchestration
- Update `src/mcp/validation/` if new rules needed

---

## Critical Files

### Existing Infrastructure (Read/Reference)
- `src/mcp/server.ts` - MCP server entry point (add new tool registrations)
- `src/mcp/validation/index.ts` - Validation rule registry
- `src/mcp/handlers/impact.ts` - Impact analysis logic (pattern to follow)
- `src/mcp/handlers/test-scaffold.ts` - Test scaffolding (extend)
- `scripts/scaffoldTest.ts` - Test scaffolding pattern
- `build/graph.json` - Dependency graph (generated)
- `graphrag/metadata.json` - Lambda/entity metadata

### New Files to Create
- `src/mcp/handlers/workflow.ts` - Workflow orchestration tool
- `src/mcp/handlers/schema-diff.ts` - Schema comparison tool
- `src/mcp/handlers/changelog.ts` - Changelog generation tool
- `src/mcp/handlers/test/workflow.test.ts` - Workflow tests
- `src/mcp/handlers/test/schema-diff.test.ts` - Schema diff tests
- `src/mcp/handlers/test/changelog.test.ts` - Changelog tests
- `docs/wiki/Automation/Agentic-Workflows.md` - Workflow documentation

### Files to Modify
- `src/mcp/server.ts` - Register new tools
- `src/mcp/handlers/test-scaffold.ts` - Add workflow integration
- `docs/wiki/Meta/Conventions-Tracking.md` - Document new workflow conventions
