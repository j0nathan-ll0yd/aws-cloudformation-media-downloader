# ADR-0012: Remocal Testing Strategy

## Status
Accepted

## Date
2025-11-27

## Context

Testing serverless applications has three main approaches:

1. **Unit Tests**: Mock everything, fast but doesn't catch integration issues
2. **LocalStack**: Emulates AWS locally, but has fidelity gaps
3. **Real AWS**: Most accurate but slow, expensive, requires deployment

Each approach alone has limitations:
- Unit tests miss service interaction bugs
- LocalStack doesn't perfectly replicate AWS behavior
- Real AWS testing is slow and costs money

## Decision

Adopt "Remocal" testing: **Local scripts that interact with real deployed AWS resources.**

### Approach
```bash
# Local script → Real AWS Lambda → Real DynamoDB → Real Response
pnpm run test-remote-list
pnpm run test-remote-hook
pnpm run test-remote-registerDevice
```

### Test Types by Purpose

| Type | Location | Purpose | Speed |
|------|----------|---------|-------|
| Unit | `src/lambdas/*/test/` | Business logic, mocked deps | Fast (ms) |
| Integration | `test/integration/` | LocalStack workflows | Medium (s) |
| Remocal | `bin/test-*.sh` | Real AWS validation | Slow (s) |

### When to Use Each

**Unit Tests (Always)**:
- Every Lambda handler
- Business logic functions
- Mock all external dependencies

**LocalStack Integration (For Workflows)**:
- Multi-service workflows
- State transitions
- Error recovery paths

**Remocal (Before Deploy / Validation)**:
- Validate against real IAM permissions
- Test actual service quotas/limits
- Verify production-like behavior
- Smoke tests after deployment

### Remocal Benefits
- Tests real IAM permissions (LocalStack is permissive)
- Tests actual Lambda memory/timeout behavior
- Validates API Gateway integration
- Catches deployment configuration issues

## Consequences

### Positive
- High confidence in deployments
- Catches permission/configuration issues early
- Validates real AWS behavior
- Complements unit and integration tests

### Negative
- Requires deployed infrastructure
- Slower than local tests
- May incur AWS costs
- Can't run offline

## Enforcement

- Remocal scripts in `bin/test-*.sh`
- Run before major deployments
- Part of post-deploy validation workflow

## Related

- [LocalStack Testing](../Testing/LocalStack-Testing.md) - Local integration tests
- [ADR-0003: Testing Philosophy](0003-testing-philosophy.md) - Overall testing approach
- [Coverage Philosophy](../Testing/Coverage-Philosophy.md) - What to test
