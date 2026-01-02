# Dependency Graph Analysis

## Quick Reference
- **When to use**: Finding transitive dependencies for Vitest mocking
- **Enforcement**: Required for accurate test mocking
- **Impact if violated**: HIGH - Missing mocks cause test failures

## The graph.json File

The `build/graph.json` file is automatically generated before builds and tests, ensuring fresh dependency analysis:

```json
{
  "directDependencies": {
    "src/lambdas/WebhookFeedly/src/index.ts": [
      "aws-lambda",
      "../../../entities/Files",
      "../../../entities/UserFiles",
      // ... all direct imports
    ]
  },
  "transitiveDependencies": {
    "src/lambdas/WebhookFeedly/src/index.ts": [
      "aws-lambda",
      "@aws-sdk/client-dynamodb",
      "@aws-sdk/lib-dynamodb",
      "electrodb",
      // ... ALL dependencies including transitive
    ]
  }
}
```

## Usage for Vitest Testing

**CRITICAL**: Use `transitiveDependencies` to find ALL mocks needed for a test file.

### Finding Required Mocks
```bash
# List all transitive dependencies for a Lambda
cat build/graph.json | jq '.transitiveDependencies["src/lambdas/WebhookFeedly/src/index.ts"]'

# Check if a specific module is needed
cat build/graph.json | jq '.transitiveDependencies["src/lambdas/ListFiles/src/index.ts"]' | grep drizzle
```

### Test Setup Process
1. Generate the graph: `pnpm run generate-graph`
2. Find your file in `transitiveDependencies`
3. Mock ALL external packages listed
4. Mock ALL vendor wrappers (lib/vendor/*)
5. Mock entity queries from `#entities/queries`

## Common Patterns

### Lambda Test Mocking
```typescript
// 1. Check graph.json for Lambda's transitive dependencies
// 2. Mock everything external BEFORE imports

// If graph.json shows these dependencies:
// ["aws-lambda", "@aws-sdk/client-s3", "drizzle-orm", "../../../entities/queries"]

// Then mock them all:
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn()
}))

vi.mock('../../../entities/queries', () => ({
  getFilesForUser: vi.fn(),
  updateFile: vi.fn()
}))

// 3. Import handler AFTER mocking
const {handler} = await import('../src/index')
```

### Debugging Missing Mocks
```bash
# If test fails with "Cannot find module X"
# Check if X is in transitive dependencies:
cat build/graph.json | jq '.transitiveDependencies["path/to/your/file.ts"]' | grep "X"

# If present, you forgot to mock it
# If absent, regenerate graph: npm run generate-graph
```

## Graph Generation

The graph is generated automatically:
- **Before builds**: `pnpm run build` runs `generate-graph` first
- **Before tests**: `pnpm test` runs `generate-graph` first
- **Before integration tests**: `pnpm test:integration` runs `generate-graph` first
- **Manual generation**: `pnpm run generate-graph`
- **Script location**: `scripts/generateDependencyGraph.ts`

**Note**: Lifecycle scripts are disabled for security (`enable-pre-post-scripts=false` in `.npmrc`), so scripts explicitly run `generate-graph` rather than using `prebuild`/`pretest` hooks.

## Best Practices

1. **Always regenerate** after adding new imports
2. **Check transitive deps** not just direct deps
3. **Mock everything external** shown in graph
4. **Use for code review** to verify import changes
5. **Automate in CI** to catch missing mocks

## Related Patterns

- [Vitest Mocking Strategy](Vitest-Mocking-Strategy.md) - How to mock
- [Mock Type Annotations](Mock-Type-Annotations.md) - TypeScript patterns
- [Integration Testing](Integration-Testing.md) - When to use real deps

---

*Use build/graph.json to identify ALL transitive dependencies for comprehensive Vitest mocking.*