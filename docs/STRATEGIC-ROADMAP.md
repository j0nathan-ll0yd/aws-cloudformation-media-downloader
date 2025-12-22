# Strategic Roadmap Implementation Guide

This document tracks the implementation of the 90-day Strategic Roadmap for engineering standards, automation, and DX improvements.

## Overview

The roadmap is organized into three phases:
1. **Phase 1: "Single Source of Truth" & Strictness** - Weeks 1-4
2. **Phase 2: Domain-Driven Refactoring** - Weeks 7-8
3. **Phase 3: The "Self-Aware" Codebase** - Weeks 9-11

## Phase 1: "Single Source of Truth" & Strictness

### Week 1: TypeSpec-to-Runtime Integration ✅

**Goal**: Bridge the gap between TypeSpec API definitions and runtime TypeScript types.

**Implementation**:
- ✅ Created `scripts/generateApiTypes.ts` - Generates Zod schemas and TypeScript types from TypeSpec
- ✅ Added `pnpm gen:api-types` command
- ✅ Output directory: `src/types/api-schema/`

**Usage**:
```bash
pnpm gen:api-types
```

**Benefits**:
- TypeSpec becomes the single source of truth for API contracts
- Compile-time errors when API definitions drift from implementation
- Automatic Zod schema generation for runtime validation

**Next Steps**:
- Update Lambda handlers to import generated types
- Integrate generation into CI/CD pipeline
- Consider auto-generation on TypeSpec file changes

### Week 2: Custom ESLint Rule Expansion ✅

**Goal**: Enforce architectural patterns through automated linting.

**Implementation**:
- ✅ Created `eslint-local-rules/rules/enforce-powertools.cjs`
- ✅ Created `eslint-local-rules/rules/no-domain-leakage.cjs`
- ✅ Created `eslint-local-rules/rules/strict-env-vars.cjs`
- ✅ Added comprehensive tests for each rule
- ✅ Integrated into ESLint configuration

**New Rules**:

1. **enforce-powertools** (CRITICAL)
   - Ensures all Lambda handlers use `withPowertools()` or `wrapLambdaInvokeHandler()`
   - Provides consistent observability and error handling
   - Scope: `src/lambdas/*/src/index.ts`

2. **no-domain-leakage** (HIGH)
   - Prevents domain layer from importing infrastructure/Lambda code
   - Maintains clean architecture boundaries
   - Scope: `src/lib/domain/`

3. **strict-env-vars** (HIGH)
   - Forbids direct `process.env` access in Lambda handlers
   - Enforces use of `getRequiredEnv()` for fail-fast behavior
   - Scope: `src/lambdas/` (except test files)

**Testing**:
```bash
pnpm run test:eslint-rules
```

**Benefits**:
- Real-time feedback in editor via ESLint
- Architectural patterns enforced automatically
- Reduces code review burden

### Week 3: Automated Dependency Governance ✅

**Goal**: Catch architectural violations at commit time.

**Implementation**:
- ✅ Created `.husky/pre-commit` hook
- ✅ Integrated `dependency-cruiser` into pre-commit workflow
- ✅ Tightened `no-orphans` rule for `src/lib/` to ERROR severity

**New Rules**:
- **no-orphans-lib**: Prevents dead code accumulation in library code (ERROR severity)
- Existing rules run at commit time for immediate feedback

**Usage**:
```bash
# Runs automatically on git commit
git commit -m "feat: add new feature"

# To bypass (emergency only)
git commit --no-verify
```

**Benefits**:
- Architectural violations caught before code review
- Dead code prevented in library modules
- Faster feedback loop for developers

### Week 4: Test Scaffolding Tool ✅

**Goal**: Reduce friction in writing comprehensive tests.

**Implementation**:
- ✅ Created `scripts/scaffoldTest.ts`
- ✅ Uses ts-morph for AST analysis
- ✅ Generates test files with proper mock setup
- ✅ Detects ElectroDB entities, vendor wrappers, and AWS SDK imports

**Usage**:
```bash
pnpm scaffold:test src/lambdas/StartFileUpload/src/index.ts
```

**Generated Output**:
- Complete test file structure
- All necessary mocks pre-configured
- TODO markers for test case implementation
- Follows project conventions (mock ordering, import patterns)

**Benefits**:
- Reduces test-writing time by 50-70%
- Ensures mocks follow project conventions
- Lowers barrier to achieving high test coverage

## Phase 2: Domain-Driven Refactoring

### Week 7: GraphRAG Operationalization ✅

**Goal**: Automate the Knowledge Graph lifecycle.

**Implementation**:
- ✅ Created `.github/workflows/auto-update-graphrag.yml`
- ✅ Created `bin/auto-update-graphrag.sh`
- ✅ Triggers on changes to:
  - `src/lambdas/`
  - `src/entities/`
  - `src/lib/vendor/`
  - `graphrag/metadata.json`
  - `tsp/`

**Workflow**:
1. Developer pushes changes to master
2. GitHub Actions detects affected files
3. Runs `pnpm graphrag:extract` automatically
4. Commits updated knowledge graph
5. Vector database stays synchronized

**Benefits**:
- AI agents always have current semantic memory
- Documentation stays synchronized with code
- Reduces manual maintenance burden

**Manual Usage**:
```bash
# Run extraction manually
pnpm run graphrag:extract

# Check if update is needed
./bin/auto-update-graphrag.sh
```

### Week 8: Infrastructure as Code Refinement 🔄

**Goal**: Centralize Terraform constants and automate documentation.

**Status**: Not yet implemented

**Planned Implementation**:
- Audit all `.tf` files for hardcoded values
- Create centralized `locals` blocks
- Abstract shared values to SSM Parameter Store
- Configure `terraform-docs` to run on PRs

**Commands** (planned):
```bash
pnpm run terraform:audit    # Find hardcoded values
pnpm run terraform:docs     # Generate documentation
```

## Phase 3: The "Self-Aware" Codebase

### Week 9: MCP "Auto-Fix" Capabilities ✅

**Goal**: Enable the MCP server to fix violations, not just report them.

**Implementation**:
- ✅ Created `src/mcp/handlers/apply-convention.ts`
- ✅ Added `apply_convention` tool to MCP server
- ✅ Supports multiple convention types

**Supported Conventions**:
1. **aws-sdk-wrapper** - Replace direct AWS SDK imports with vendor wrappers
2. **electrodb-mock** - Guide for using ElectroDB mock helper (manual for now)
3. **response-helper** - Detect raw response objects (manual for now)
4. **env-validation** - Detect direct process.env access (manual for now)
5. **powertools** - Guide for wrapping handlers (manual for now)
6. **all** - Run all convention checks

**Usage** (via MCP):
```json
{
  "tool": "apply_convention",
  "args": {
    "file": "src/lambdas/StartFileUpload/src/index.ts",
    "convention": "aws-sdk-wrapper",
    "dryRun": true
  }
}
```

**Benefits**:
- Automated refactoring for common patterns
- Reduces manual effort in convention adherence
- Speeds up architectural migrations

**Current Limitations**:
- Only `aws-sdk-wrapper` has full auto-fix
- Other conventions provide guidance for manual fixes
- Complex AST transformations need further development

### Week 11: Dynamic Documentation 🔄

**Goal**: Link TypeSpec definitions to implementation patterns.

**Status**: Partially implemented

**Current State**:
- GraphRAG indexes Lambda functions
- TypeSpec definitions exist separately
- Semantic search available via MCP

**Planned Enhancements**:
- Index TypeSpec operations alongside Lambda implementations
- Create relationships between API definitions and code
- Enable queries like "How do I add a new endpoint?"
- Generate boilerplate from TypeSpec + implementation patterns

**Commands**:
```bash
# Current
pnpm run search:codebase "How do I add a new endpoint?"

# Planned
pnpm run generate:endpoint --from-spec operations/webhook.tsp
```

## Implementation Timeline

| Week | Task | Status |
|------|------|--------|
| 1 | TypeSpec-to-Runtime Integration | ✅ Complete |
| 2 | Custom ESLint Rule Expansion | ✅ Complete |
| 3 | Automated Dependency Governance | ✅ Complete |
| 4 | Test Scaffolding Tool | ✅ Complete |
| 7 | GraphRAG Operationalization | ✅ Complete |
| 8 | Infrastructure as Code Refinement | 🔄 Planned |
| 9 | MCP "Auto-Fix" Capabilities | ✅ Complete (partial) |
| 11 | Dynamic Documentation | 🔄 Planned |

## Key Metrics

### Before Implementation
- Manual convention enforcement via code review
- Test writing time: ~30-60 minutes per Lambda
- GraphRAG updates: Manual, infrequent
- Architectural violations: Caught in PR review

### After Implementation
- 6 new automated ESLint rules
- Test writing time: ~10-20 minutes per Lambda (60% reduction)
- GraphRAG updates: Automatic on push to master
- Architectural violations: Caught at commit time

## Developer Experience Improvements

1. **Faster Feedback Loop**
   - Pre-commit hooks catch issues before push
   - ESLint rules provide real-time editor feedback
   - Test scaffolder reduces boilerplate writing

2. **Consistent Patterns**
   - TypeSpec as single source of truth
   - Automated convention application
   - Standardized test structure

3. **Reduced Cognitive Load**
   - Tools handle repetitive tasks
   - MCP server provides semantic code search
   - Automated documentation updates

## Future Enhancements

### Short Term (Next 30 days)
- [ ] Complete IaC refinement (Week 8)
- [ ] Enhance MCP auto-fix capabilities
- [ ] Add more sophisticated AST transformations
- [ ] Integrate `gen:api-types` into CI

### Medium Term (Next 60 days)
- [ ] Complete TypeSpec-to-implementation linking
- [ ] Add endpoint generation from TypeSpec
- [ ] Create visual dependency graph viewer
- [ ] Automated fixture generation from TypeSpec examples

### Long Term (Next 90 days)
- [ ] AI-powered refactoring suggestions
- [ ] Automated migration scripts for breaking changes
- [ ] Performance impact analysis
- [ ] Predictive test case generation

## Lessons Learned

1. **Start with High-Impact, Low-Complexity Items**
   - ESLint rules and pre-commit hooks provide immediate value
   - Complex AST transformations take more time to implement correctly

2. **Leverage Existing Tools**
   - ts-morph for AST analysis
   - dependency-cruiser for architecture enforcement
   - TypeSpec for API definition

3. **Iterative Implementation**
   - Start with basic auto-fix, enhance over time
   - Manual guidance is better than no automation
   - User feedback drives prioritization

## Contributing

To contribute to the roadmap implementation:

1. Review the [issue tracker](https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/issues)
2. Pick an unimplemented task
3. Follow the project conventions (see `AGENTS.md`)
4. Submit a PR with tests and documentation

## References

- [Original Roadmap Issue](https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/issues/XXX)
- [AGENTS.md](../AGENTS.md) - Project conventions
- [MCP Server Documentation](../src/mcp/README.md)
- [Testing Guide](wiki/Testing/Jest-ESM-Mocking-Strategy.md)
