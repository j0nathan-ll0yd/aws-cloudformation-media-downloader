# Coverage Philosophy

## Quick Reference
- **When to use**: Planning and writing tests
- **Enforcement**: Recommended - guides testing strategy
- **Impact if violated**: Low - may write unnecessary tests

## Core Principle

**Test YOUR Code, Not Library Code**

Coverage should be a side effect of testing business logic, not a goal itself. Integration tests validate YOUR orchestration, not AWS SDK behavior.

## Test Focus

### ❌ Wrong: Testing Libraries
- "Can I upload to S3?" → Testing AWS SDK
- "Does DynamoDB query work?" → Testing AWS SDK

### ✅ Correct: Testing YOUR Logic
- "Does download workflow complete?" → Testing YOUR orchestration
- "After S3 upload, is DynamoDB updated?" → Testing YOUR state management
- "Does error rollback DynamoDB?" → Testing YOUR error recovery

## Test Types

### Unit Tests
- **Purpose**: Test function logic in isolation
- **Mock**: ALL external dependencies (AWS, APIs, packages)
- **Speed**: Milliseconds per test
- **Location**: `src/lambdas/*/test/index.test.ts`

```typescript
test('applies 15% discount for premium users', () => {
  expect(calculateDiscount(100, true)).toBe(85)
})
```

### Integration Tests
- **Purpose**: Test multi-service workflows end-to-end
- **Use**: Real AWS services (via LocalStack)
- **Test**: YOUR orchestration, state management, error handling
- **Location**: `test/integration/workflows/*.workflow.integration.test.ts`

```typescript
test('download updates DynamoDB and notifies user', async () => {
  await triggerDownload(fileId)
  const file = await getFileFromDB(fileId)
  expect(file.status).toBe('downloaded')
  expect(notificationSent).toBe(true)
})
```

## Decision Tree: Unit or Integration Test?

Use this flowchart to decide which test type to write:

```
┌─────────────────────────────────────────────────────────────┐
│                    What are you testing?                     │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    ┌─────────────────┐             ┌─────────────────┐
    │ Single function │             │ Multi-service   │
    │ or module       │             │ workflow        │
    └────────┬────────┘             └────────┬────────┘
             │                                │
             ▼                                ▼
    ┌─────────────────┐             ┌─────────────────┐
    │ Does it call    │             │ INTEGRATION     │
    │ AWS services?   │             │ TEST            │
    └────────┬────────┘             │                 │
             │                      │ Use LocalStack  │
      ┌──────┴──────┐               │ for all AWS     │
      ▼             ▼               │ services        │
    ┌────┐       ┌────┐             └─────────────────┘
    │ No │       │Yes │
    └──┬─┘       └──┬─┘
       │            │
       ▼            ▼
 ┌───────────┐  ┌─────────────────────────────────────┐
 │ UNIT TEST │  │ Can the service be emulated         │
 │           │  │ by LocalStack?                      │
 │ Mock all  │  └──────────────┬──────────────────────┘
 │ imports   │          ┌──────┴──────┐
 └───────────┘          ▼             ▼
                      ┌────┐       ┌────┐
                      │Yes │       │ No │
                      └──┬─┘       └──┬─┘
                         │            │
                         ▼            ▼
              ┌─────────────────┐  ┌─────────────────┐
              │ INTEGRATION     │  │ UNIT TEST       │
              │ TEST            │  │                 │
              │                 │  │ Mock the        │
              │ Use real        │  │ external        │
              │ LocalStack      │  │ service         │
              └─────────────────┘  └─────────────────┘
```

### Quick Reference

| Testing... | Test Type | Mock Strategy |
|------------|-----------|---------------|
| Pure business logic | Unit | Mock everything |
| Data transformations | Unit | Mock everything |
| Single Lambda handler | Unit | Mock AWS + DB |
| SNS/SQS/S3 workflows | Integration | Use LocalStack |
| Database queries | Integration | Use real PostgreSQL |
| Multi-Lambda chains | Integration | Use LocalStack |
| APNS notifications | Unit | Mock apns2 (external) |
| OAuth flows | Unit | Mock provider (external) |
| GitHub API calls | Unit | Mock API (external) |

### Key Principle

**Integration tests should NEVER mock LocalStack-emulatable services.**

If you find yourself mocking `#lib/vendor/AWS/SNS` or `#lib/vendor/AWS/SQS` in an integration test, you're writing a "mock disguised" test. Convert it to use real LocalStack.

See: [Integration Test Audit](Integration-Test-Audit.md) for current test classification.

## Integration Test Priority

### High Priority (Multi-Service)
- ✅ webhook → DynamoDB → queue → Lambda → S3
- ✅ State transitions across services
- ✅ Error rollback logic
- ✅ Fan-out patterns

### Medium Priority (Service + Logic)
- ✅ Query filtering and pagination
- ✅ Conditional creates/updates
- ✅ Batch operations with partial failures

### Low Priority (Simple CRUD)
- ❌ Pure CRUD → Unit tests sufficient
- ❌ Thin wrappers → Covered by unit tests

## Coverage Targets

### Unit Tests
- Lambda handlers: **80%+**
- Utility functions: **90%+**
- Business logic: **85%+**
- Vendor wrappers: Ignore with `/* c8 ignore */`

### Integration Tests
- Coverage happens naturally from workflow tests
- Don't write tests to hit coverage targets
- Focus on workflows, not library behavior

## What to Test

### ✅ DO Test
- Data transformations, validation, calculations
- State transitions and error handling
- Service call sequences and data flow
- Edge cases and boundary conditions

### ❌ DON'T Test
- AWS SDK functionality
- NPM package behavior
- Implementation details (variable names, private functions)

## Testing Patterns

### Test YOUR Orchestration
```typescript
test('download workflow completes end-to-end', async () => {
  await createFile(fileId, 'pending')
  await startDownload(fileId)
  await processDownload(fileId)

  const file = await getFile(fileId)
  expect(file.status).toBe('downloaded')

  const notifications = await getNotifications(userId)
  expect(notifications).toHaveLength(1)
})
```

### Ignore Vendor Wrappers in Unit Tests
```typescript
/* c8 ignore start */
export async function createS3Upload(bucket: string, key: string, body: any) {
  // Tested via integration tests
  return new Upload({client: s3Client, params: {Bucket: bucket, Key: key, Body: body}})
}
/* c8 ignore end */
```

## Test Organization

Structure by workflow, not service:
```
test/integration/workflows/
├── webhookFeedly.workflow.integration.test.ts
├── fileDownload.workflow.integration.test.ts
└── deviceRegistration.workflow.integration.test.ts
```

## Success Indicators

### Good
✅ Tests describe business requirements
✅ Tests fail when logic breaks
✅ High coverage of YOUR code
✅ Fast unit tests (< 1 s)

### Bad
❌ Tests describe implementation
❌ High coverage via shallow tests
❌ Slow unit tests (> 5 s)
❌ Many integration tests for CRUD

## Related Patterns
- [Vitest Mocking Strategy](Vitest-Mocking-Strategy.md) - Mocking dependencies
- [Mock Type Annotations](Mock-Type-Annotations.md) - Type-safe mocking
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - What to test

---

*Test YOUR code, not library code. Coverage follows from testing business logic. Focus on workflows and orchestration.*