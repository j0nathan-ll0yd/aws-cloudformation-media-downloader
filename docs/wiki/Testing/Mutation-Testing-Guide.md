# Mutation Testing Guide

## Overview

This project uses [Stryker](https://stryker-mutator.io/) for mutation testing with:
- `@stryker-mutator/vitest-runner` - Vitest integration
- `@stryker-mutator/typescript-checker` - Type-safe mutations

Mutation testing evaluates test suite quality by introducing small code changes (mutants) and verifying that tests detect them. A high mutation score indicates comprehensive test coverage.

## Configuration

**Configuration file:** `stryker.config.json`

### Key Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| `typescriptChecker.prioritizePerformanceOverAccuracy` | `true` | 43% faster with 99.1% accuracy |
| `vitest.related` | `true` | Only run tests related to mutated files |
| `incremental` | `true` | Reuse results from previous runs |
| `thresholds.break` | `45` | Fail build if mutation score below 45% |

### Excluded Mutations

- `StringLiteral` - Config strings, log messages
- `ObjectLiteral` - AWS SDK config objects

### Excluded Paths

- `src/mcp/**` - Tested via AST fixtures
- `src/lib/vendor/**` - Integration tested with LocalStack

## Running Mutation Tests

### Local Development

```bash
# Full mutation test
pnpm run test:mutation

# Incremental (faster, uses cached results)
pnpm run test:mutation:incremental

# Test specific Lambda functions
pnpm run test:mutation:auth
```

### CI Integration

```yaml
# .github/workflows/mutation.yml
mutation-test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Setup pnpm
      uses: pnpm/action-setup@v2

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '22'
        cache: 'pnpm'

    - name: Install dependencies
      run: pnpm install

    - name: Download incremental baseline
      uses: actions/cache@v4
      with:
        path: reports/stryker-incremental.json
        key: stryker-${{ github.base_ref }}-${{ hashFiles('src/**/*.ts') }}
        restore-keys: |
          stryker-${{ github.base_ref }}-
          stryker-main-

    - name: Run incremental mutation test
      run: pnpm run test:mutation:incremental

    - name: Upload mutation report
      uses: actions/upload-artifact@v4
      with:
        name: mutation-report
        path: reports/mutation/
```

### Incremental Mode Best Practices

1. **Cache the baseline file** (`reports/stryker-incremental.json`)
2. **Run full tests weekly** on main branch with `--force`
3. **PR-based testing** uses incremental mode for speed

## Thresholds

| Threshold | Value | Meaning |
|-----------|-------|---------|
| `high` | 70% | Green status in report |
| `low` | 50% | Yellow/warning status |
| `break` | 45% | Build fails below this |

### Target by Component

- **Auth Lambdas** (ApiGatewayAuthorizer, LoginUser, RegisterUser): Target 70%+
- **Core Lambdas** (ListFiles, StartFileUpload, S3ObjectCreated): Target 60%+
- **Utility Lambdas** (PruneDevices, CleanupExpiredRecords): Target 50%+

## Interpreting Results

### Mutant Statuses

- **Killed**: Test detected the mutation (good)
- **Survived**: No test caught the mutation (needs investigation)
- **NoCoverage**: No test covers this code
- **Timeout**: Test ran too long (often indicates infinite loop mutation)
- **CompileError**: Invalid mutation caught by TypeScript
- **Ignored**: Static code or excluded mutation type

### Improving Mutation Score

1. Focus on **Survived** mutants first
2. Check for missing edge case tests
3. Use `// Stryker disable next-line` sparingly for false positives

## Inline Disabling

For legitimate cases where mutations don't need testing:

```typescript
// Stryker disable next-line StringLiteral: Log message not testable
logger.info('Processing file upload');

// Stryker disable all: Configuration constants
export const CONFIG = {
  timeout: 30000,
  retries: 3
};
// Stryker restore all
```

## Performance Optimization

The configuration includes several performance optimizations:

| Setting | Impact |
|---------|--------|
| `typescriptChecker.prioritizePerformanceOverAccuracy` | 43% faster TypeScript checking |
| `vitest.related: true` | Only runs related tests per mutant |
| `maxTestRunnerReuse: 50` | Prevents memory leaks in long runs |
| `incremental: true` | Caches results for unchanged code |
| `timeoutFactor: 2.5` | Accommodates async Lambda operations |

## Related Documentation

- [Coverage Philosophy](./Coverage-Philosophy.md)
- [Vitest Mocking Strategy](./Vitest-Mocking-Strategy.md)
- [Test Suite Audit](./Test-Suite-Audit.md)
