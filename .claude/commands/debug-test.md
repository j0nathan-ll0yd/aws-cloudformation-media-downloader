# Guided Test Debugging

Debug failing tests with guided analysis of missing mocks, dependency issues, and common problems.

## Quick Start

```bash
# Usage: /debug-test <test-file-or-lambda>
# Example: /debug-test src/lambdas/ListFiles/test/index.test.ts
# Example: /debug-test ListFiles
```

## Workflow

### Step 1: Identify Test File

Parse input to find test file:

```bash
# If Lambda name provided
TEST_FILE="src/lambdas/${LAMBDA_NAME}/test/index.test.ts"

# Verify file exists
if [ ! -f "$TEST_FILE" ]; then
  echo "Test file not found: $TEST_FILE"
fi
```

### Step 2: Run Test in Verbose Mode

```bash
pnpm test -- --reporter=verbose $TEST_FILE
```

Capture error output for analysis.

### Step 3: Analyze Missing Mocks

```
MCP Tool: check_coverage
File: [source file for Lambda]
Query: missing
```

Identifies imports that need mocking but aren't mocked.

### Step 4: Trace Dependencies

```
MCP Tool: query_dependencies
File: [source file]
Query: transitive
```

Shows full dependency chain to identify mock gaps.

### Step 5: Suggest Mock Setup

```
MCP Tool: suggest_tests
File: [source file]
Query: mocks
```

Generates required mock declarations.

### Step 6: Identify Common Issues

Check for known problems:

| Issue | Detection | Fix |
|-------|-----------|-----|
| Missing vi.mock | Import error | Add mock declaration |
| Mock type mismatch | Type error on mock | Add proper type annotation |
| Async mock issue | Promise rejection | Add mockResolvedValue |
| Module not found | Module resolution error | Check import path |
| Hoisting issue | vi.mock not hoisted | Move to top of file |

---

## Common Error Patterns

### Error: Module not found

```
Cannot find module '#entities/queries' from 'src/lambdas/ListFiles/src/index.ts'
```

**Fix**: Add mock for the module:
```typescript
vi.mock('#entities/queries', () => ({
  getUser: vi.fn(),
  // ... other exports
}));
```

### Error: X is not a function

```
TypeError: getUser is not a function
```

**Fix**: Ensure mock is properly structured:
```typescript
vi.mock('#entities/queries', () => ({
  getUser: vi.fn().mockResolvedValue({ userId: 'test' }),
}));
```

### Error: Mock type mismatch

```
Type 'Mock<any, any>' is not assignable to type...
```

**Fix**: Add proper type annotation:
```typescript
const mockGetUser = vi.fn() as Mock<[string], Promise<UserRow | null>>;
```

### Error: Timeout

```
Test timeout of 5000ms exceeded
```

**Fix**: Check for unresolved promises:
```typescript
// Ensure all mocks resolve
(getUser as Mock).mockResolvedValue(mockUser);

// Or increase timeout for slow tests
it('should handle...', async () => { ... }, 10000);
```

### Error: Cannot read property of undefined

```
Cannot read property 'statusCode' of undefined
```

**Fix**: Handler returned undefined - check mock setup:
```typescript
// Ensure handler gets valid event
const event = createApiGatewayEvent({ body: JSON.stringify(validInput) });
const result = await handler(event, mockContext);
```

---

## Mock Template Generator

### Step 1: Get Required Mocks

```
MCP Tool: check_coverage
File: src/lambdas/[Lambda]/src/index.ts
Query: required
```

### Step 2: Generate Mock Block

Based on dependencies, generate:

```typescript
// Entity mocks
vi.mock('#entities/queries', () => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));

// Vendor mocks
vi.mock('#lib/vendor/AWS/DynamoDB', () => ({
  getDynamoDBClient: vi.fn(),
}));

vi.mock('#lib/vendor/AWS/Powertools', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  tracer: { getSegment: vi.fn(() => ({ addAnnotation: vi.fn() })) },
  metrics: { addMetric: vi.fn() },
}));

// Environment mocks
vi.mock('#util/env', () => ({
  getRequiredEnv: vi.fn((key: string) => `mock-${key}`),
}));
```

---

## Human Checkpoints

1. **Review error analysis** - Confirm root cause identified
2. **Approve suggested mocks** - Before adding to test file
3. **Verify fix works** - After applying changes

---

## Debugging Workflow

### Phase 1: Understand the Failure

1. Read the error message carefully
2. Identify the failing test case
3. Check line number in stack trace

### Phase 2: Analyze Dependencies

1. Run `check_coverage` for missing mocks
2. Review `query_dependencies` for import chain
3. Compare with working test files

### Phase 3: Apply Fixes

1. Add missing mock declarations
2. Fix mock return values
3. Add type annotations if needed

### Phase 4: Verify

```bash
# Run specific test
pnpm test -- $TEST_FILE

# Run with coverage
pnpm test -- --coverage $TEST_FILE
```

---

## Output Format

```markdown
## Test Debug Analysis: [test file]

### Error Summary
```
[Error message from test run]
```

### Root Cause
[Identified cause of failure]

### Missing Mocks (3 found)

| Module | Exports Needed | Status |
|--------|----------------|--------|
| #entities/queries | getUser, createUser | MISSING |
| #lib/vendor/AWS/S3 | getS3Client | MISSING |
| #util/env | getRequiredEnv | PRESENT |

### Suggested Fix

```typescript
// Add these mocks at the top of the test file
vi.mock('#entities/queries', () => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
}));

vi.mock('#lib/vendor/AWS/S3', () => ({
  getS3Client: vi.fn(),
}));
```

### Related Issues
- Similar test: src/lambdas/RegisterUser/test/index.test.ts (working example)
- Documentation: docs/wiki/Testing/Vitest-Mocking-Strategy.md

### After Fix
```bash
pnpm test -- src/lambdas/[Lambda]/test/index.test.ts
```
```

---

## Notes

- Always check existing working tests for patterns
- Use `test/helpers/entity-fixtures.ts` for mock data
- Use `test/helpers/aws-sdk-mock.ts` for AWS SDK mocks
- Refer to `docs/wiki/Testing/Vitest-Mocking-Strategy.md` for patterns
