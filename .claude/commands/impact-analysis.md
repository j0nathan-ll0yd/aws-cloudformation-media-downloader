# Dependency Impact Analysis

Analyze the impact of changing a file, showing affected Lambdas, tests, and infrastructure.

## Quick Start

```bash
# Usage: /impact-analysis <file-path>
# Example: /impact-analysis src/entities/queries/user-queries.ts
# Example: /impact-analysis src/lambdas/ListFiles/src/index.ts
```

## Workflow

### Step 1: Identify Target

Parse the input to determine:
- File path or Lambda name
- Type of target (Lambda, Entity, Utility, Type)

### Step 2: Query Impact

```
MCP Tool: lambda_impact
File: [target file]
Query: all
```

This returns:
- **Dependents**: Files that import this file
- **Cascade**: Transitive dependencies
- **Tests**: Test files that need updating
- **Infrastructure**: Lambda configurations affected

### Step 3: Query Dependencies

```
MCP Tool: query_dependencies
File: [target file]
Query: dependents
```

Lists all files that depend on the target.

### Step 4: Check for Breaking Changes

If modifying exports:

```
MCP Tool: diff_semantic
Query: breaking
Scope: src
```

Identifies potential breaking changes.

### Step 5: Generate Impact Report

Present findings in structured format.

---

## Output Format

```markdown
## Impact Analysis: [file path]

### Target Information
- **File**: src/entities/queries/user-queries.ts
- **Type**: Entity Query Module
- **Exports**: getUser, createUser, updateUser, deleteUser

### Direct Dependents (5 files)

| File | Import Used | Impact |
|------|-------------|--------|
| src/lambdas/LoginUser/src/index.ts | getUser | HIGH |
| src/lambdas/RegisterUser/src/index.ts | createUser | HIGH |
| src/lambdas/UserDelete/src/index.ts | deleteUser | HIGH |
| src/lambdas/ListFiles/src/index.ts | getUser | MEDIUM |
| src/lambdas/RefreshToken/src/index.ts | getUser | MEDIUM |

### Transitive Dependencies (8 files)

Files indirectly affected through import chains:
- src/lambdas/ApiGatewayAuthorizer/src/index.ts (via LoginUser patterns)
- [additional files...]

### Affected Tests (5 files)

| Test File | Mocks Required |
|-----------|----------------|
| src/lambdas/LoginUser/test/index.test.ts | getUser |
| src/lambdas/RegisterUser/test/index.test.ts | createUser |
| src/lambdas/UserDelete/test/index.test.ts | deleteUser |
| src/lambdas/ListFiles/test/index.test.ts | getUser |
| src/lambdas/RefreshToken/test/index.test.ts | getUser |

### Infrastructure Impact

| Resource | Change Required |
|----------|-----------------|
| None | No infrastructure changes needed |

### Breaking Change Risk

| Change Type | Risk Level | Mitigation |
|-------------|------------|------------|
| Function signature change | HIGH | Update all callers |
| Return type change | HIGH | Migration required |
| New required parameter | HIGH | Add to all callers |
| New optional parameter | LOW | Backwards compatible |

### Recommended Actions

1. **Before making changes**:
   - [ ] Review all 5 dependent files
   - [ ] Prepare test updates for affected tests
   - [ ] Consider backwards compatibility

2. **If changing function signatures**:
   - [ ] Run `/check-breaking` to analyze impact
   - [ ] Update all dependent files
   - [ ] Update all test mocks

3. **After making changes**:
   - [ ] Run `pnpm test` to verify tests pass
   - [ ] Run `pnpm run ci:local` for full validation

### Related Commands

- `/check-breaking` - Detailed breaking change analysis
- `/analyze-tests` - Test coverage for affected files
- `/validate` - Convention validation
```

---

## Human Checkpoints

1. **Review impact scope** - Confirm understanding of affected files
2. **Assess risk level** - Determine if changes are safe to proceed
3. **Plan updates** - Before modifying, plan dependent file updates

---

## Impact Levels

| Level | Description | Action |
|-------|-------------|--------|
| **CRITICAL** | Core utility, many dependents | Extensive testing required |
| **HIGH** | Multiple Lambdas depend on this | Update all dependents |
| **MEDIUM** | Some dependents, limited scope | Standard testing |
| **LOW** | Isolated change, few dependents | Normal workflow |

---

## Usage Examples

### Analyze Entity Impact

```bash
/impact-analysis src/entities/queries/file-queries.ts
```

Shows all Lambdas using file operations.

### Analyze Utility Impact

```bash
/impact-analysis util/response.ts
```

Shows all handlers using the response helper.

### Analyze Lambda Impact

```bash
/impact-analysis src/lambdas/StartFileUpload/src/index.ts
```

Shows downstream effects if this Lambda changes.

---

## Notes

- Use before major refactoring
- Helps prioritize test updates
- Identifies hidden dependencies
- Guides safe migration strategies
