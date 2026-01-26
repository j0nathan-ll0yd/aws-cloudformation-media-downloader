# ADR-0003: Test Business Logic, Not Library Code

## Status
Accepted

## Date
2025-11-27

## Context

Common testing anti-patterns observed in Lambda projects:

1. **Coverage-Driven Testing**: Writing tests to hit coverage targets rather than validate behavior
2. **Library Testing**: Testing that AWS SDK works (it does - AWS tests it)
3. **Shallow Tests**: High coverage via simple existence checks
4. **CRUD Overload**: Integration tests for every CRUD operation

These patterns lead to:
- Slow test suites
- False confidence in coverage numbers
- Tests that don't catch real bugs
- Maintenance burden from brittle tests

## Decision

**Test YOUR Code, Not Library Code**

Coverage should be a side effect of testing business logic, not a goal itself.

### Test Focus
- **DO test**: Data transformations, validation, calculations, state transitions, error handling, service call sequences
- **DON'T test**: AWS SDK functionality, NPM package behavior, implementation details

### Test Types

| Type | Purpose | Mock Level | Speed |
|------|---------|------------|-------|
| Unit Tests | Function logic in isolation | ALL external dependencies | Milliseconds |
| Integration Tests | Multi-service workflows | Real AWS (LocalStack) | Seconds |

### Coverage Targets
- Lambda handlers: 80%+
- Utility functions: 90%+
- Business logic: 85%+
- Vendor wrappers: Ignore with `/* c8 ignore */`

### Integration Test Priority
- **High**: Multi-service workflows (webhook → DynamoDB → queue → Lambda → S3)
- **Medium**: Query filtering, conditional updates, batch operations
- **Low**: Pure CRUD (unit tests sufficient)

## Consequences

### Positive
- Tests describe business requirements, not implementation
- Fast unit test suites (under 1 second total)
- Tests fail when logic breaks, not when SDKs change
- Focus on workflows catches real integration bugs
- Less test maintenance burden

### Negative
- Requires discipline to avoid coverage-chasing
- Some developers prefer explicit SDK testing
- Must understand what "YOUR orchestration" means

## Enforcement

- Code review: Tests should describe business behavior
- Test naming: Should read like requirements, not implementation
- Coverage reports: Review to ensure coverage comes from meaningful tests

## Related

- [Coverage Philosophy](../Testing/Coverage-Philosophy.md) - Implementation guide
- [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) - Mocking dependencies
- [ADR-0004: Lazy Initialization](0004-lazy-initialization.md) - Enables testability
