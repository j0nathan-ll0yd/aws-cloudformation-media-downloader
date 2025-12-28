# Test Gap Analysis & Scaffolding

Analyze test coverage across all Lambda functions, identify missing mocks, and generate test scaffolds for untested code.

## Quick Start

```bash
# Run coverage analysis
pnpm test -- --coverage

# Check which Lambdas have tests
ls -la src/lambdas/*/test/
```

## Workflow

### Step 1: Scan Lambda Test Coverage

Identify which Lambdas have test files:

```bash
# List all Lambdas
LAMBDAS=$(ls -d src/lambdas/*/src/index.ts 2>/dev/null | sed 's|src/lambdas/||;s|/src/index.ts||')

# Check for test files
for lambda in $LAMBDAS; do
  if [ -f "src/lambdas/$lambda/test/index.test.ts" ]; then
    echo "✓ $lambda has tests"
  else
    echo "✗ $lambda MISSING tests"
  fi
done
```

### Step 2: Analyze Mock Coverage

For each Lambda with tests, verify all transitive dependencies are mocked:

```
MCP Tool: check_coverage
File: src/lambdas/[LambdaName]/src/index.ts
Query: all
```

This returns:
- **Required mocks**: All imports that need mocking
- **Missing mocks**: Imports not currently mocked in tests
- **Coverage gaps**: Code paths without test coverage

### Step 3: Use Dependency Graph

Query `build/graph.json` for transitive dependencies:

```bash
# Get all dependencies for a Lambda
cat build/graph.json | jq '.transitiveDependencies["src/lambdas/ListFiles/src/index.ts"]'
```

Dependencies that need mocking:
- `#lib/vendor/AWS/*` - AWS SDK wrappers
- `#entities/*` - Database entities
- External HTTP calls
- File system operations

### Step 4: Prioritize by Impact

Use MCP to calculate blast radius:

```
MCP Tool: lambda_impact
File: src/lambdas/[LambdaName]/src/index.ts
Query: dependents
```

Prioritize testing:
1. Lambdas with most dependents (high blast radius)
2. Lambdas handling user authentication
3. Lambdas with database write operations
4. Lambdas recently modified

### Step 5: Generate Test Scaffolds

For Lambdas missing tests:

```
MCP Tool: suggest_tests
File: src/lambdas/[LambdaName]/src/index.ts
Query: scaffold
```

This generates:
- Test file structure
- Required mock setup
- Test fixtures based on handler signature
- Common test cases for the trigger type

## Test Scaffold Template

Generated test files follow this structure:

```typescript
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { [EventType] } from 'aws-lambda';
import { handler } from '../src';

// Mock vendor dependencies
vi.mock('#lib/vendor/AWS/DynamoDB', () => ({
  getDynamoDBClient: vi.fn(),
}));

vi.mock('#entities/Users', () => ({
  Users: {
    get: vi.fn(),
    create: vi.fn(),
    query: vi.fn(),
  },
}));

// Import mocks after vi.mock declarations
import { getDynamoDBClient } from '#lib/vendor/AWS/DynamoDB';
import { Users } from '#entities/Users';

describe('[LambdaName]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful operations', () => {
    it('should handle valid request', async () => {
      // Arrange
      const mockEvent: [EventType] = {
        // Event fixture
      };

      (Users.get as Mock).mockResolvedValue({
        // Mock response
      });

      // Act
      const result = await handler(mockEvent);

      // Assert
      expect(result.statusCode).toBe(200);
      expect(Users.get).toHaveBeenCalledWith(/* expected args */);
    });
  });

  describe('error handling', () => {
    it('should handle missing required field', async () => {
      // Test validation errors
    });

    it('should handle database errors', async () => {
      // Test error propagation
    });
  });
});
```

## Mock Patterns by Dependency Type

### AWS SDK Vendor Mocks

```typescript
vi.mock('#lib/vendor/AWS/DynamoDB', () => ({
  getDynamoDBClient: vi.fn(),
  putItem: vi.fn(),
  getItem: vi.fn(),
  queryItems: vi.fn(),
}));
```

### Entity Mocks

```typescript
vi.mock('#entities/Users', () => ({
  Users: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: vi.fn(),
  },
}));
```

### Environment Variable Mocks

```typescript
vi.mock('#util/env', () => ({
  getRequiredEnv: vi.fn((key: string) => {
    const envMap: Record<string, string> = {
      TABLE_NAME: 'test-table',
      BUCKET_NAME: 'test-bucket',
    };
    return envMap[key] ?? `mock-${key}`;
  }),
}));
```

## Coverage Report Format

```markdown
## Test Coverage Analysis

### Lambdas Without Tests (CRITICAL)
| Lambda | Trigger Type | Blast Radius | Priority |
|--------|-------------|--------------|----------|
| NewLambda | API Gateway | 3 dependents | P1 |
| OtherLambda | SQS | 1 dependent | P2 |

### Lambdas With Incomplete Mocks (HIGH)
| Lambda | Missing Mocks | Coverage |
|--------|---------------|----------|
| ListFiles | S3Client | 78% |
| LoginUser | BetterAuth | 65% |

### Well-Tested Lambdas (OK)
| Lambda | Coverage | Last Updated |
|--------|----------|--------------|
| RegisterDevice | 95% | 2025-12-20 |
| WebhookFeedly | 92% | 2025-12-18 |

### Summary
- Total Lambdas: 18
- With Tests: 16 (89%)
- Full Mock Coverage: 14 (78%)
- Average Coverage: 82%
```

## Batch Operations

### Generate All Missing Tests

```bash
# Find Lambdas without tests
for lambda in $(ls -d src/lambdas/*/); do
  name=$(basename $lambda)
  if [ ! -f "$lambda/test/index.test.ts" ]; then
    echo "Generating test scaffold for $name..."
    # Use MCP suggest_tests
  fi
done
```

### Update Outdated Tests

```bash
# Find tests older than source
for lambda in $(ls -d src/lambdas/*/); do
  src="$lambda/src/index.ts"
  test="$lambda/test/index.test.ts"
  if [ -f "$test" ] && [ "$src" -nt "$test" ]; then
    echo "Test may be outdated: $test"
    # Use MCP check_coverage to verify mocks
  fi
done
```

## Human Checkpoints

1. **Review priority order** before generating scaffolds
2. **Verify mock completeness** after generation
3. **Add specific test cases** beyond the scaffold
4. **Run full test suite** after adding new tests

## Integration with CI

Add to GitHub Actions:

```yaml
- name: Test Coverage Analysis
  run: |
    pnpm test -- --coverage
    # Check for coverage regressions
    if [ $(cat coverage/coverage-summary.json | jq '.total.lines.pct') -lt 80 ]; then
      echo "Coverage dropped below 80%"
      exit 1
    fi
```

## Notes

- Always use `test/helpers/entity-mock.ts` for entity mocks
- Follow the Mock Type Annotations guide (`docs/wiki/Testing/Mock-Type-Annotations.md`)
- Tests should verify behavior, not implementation
- Aim for 80%+ coverage per Lambda
- Run `pnpm run ci:local` to validate all tests pass
