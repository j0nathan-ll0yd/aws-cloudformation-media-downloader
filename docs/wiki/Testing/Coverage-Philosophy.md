# Coverage Philosophy

## Quick Reference
- **When to use**: Planning and writing tests
- **Enforcement**: Recommended - guides testing strategy
- **Impact if violated**: Low - may write unnecessary tests

## The Core Principle

**Test YOUR Code, Not Library Code**

Integration tests should validate YOUR orchestration logic, not AWS SDK behavior. Coverage should be a side effect of testing business logic, not a goal in itself.

## Wrong vs Correct Focus

### ❌ Wrong Focus (Testing Libraries)

These test library behavior, not your code:
- "Can I upload to S3?" → Testing AWS SDK
- "Does multipart upload work?" → Testing AWS SDK
- "Can I query DynamoDB?" → Testing AWS SDK
- "Does Lambda invocation work?" → Testing AWS SDK
- "Can I publish to SNS?" → Testing AWS SDK

### ✅ Correct Focus (Testing YOUR Business Logic)

These test your orchestration and business rules:
- "Does the complete download workflow succeed?" → Testing YOUR code
- "When DynamoDB query returns files, does Lambda fan-out work?" → Testing YOUR orchestration
- "After S3 upload, is DynamoDB updated with correct status?" → Testing YOUR state management
- "Does error handling rollback DynamoDB when S3 fails?" → Testing YOUR error recovery
- "Are notifications sent only after successful downloads?" → Testing YOUR business rules

## Test Types

### Unit Tests

**Purpose**: Test individual function logic in isolation

**Characteristics**:
- Mock ALL external dependencies (AWS services, external APIs, NPM packages)
- Test function logic, edge cases, error paths
- Fast execution (milliseconds per test)
- High coverage of edge cases
- Located in: `src/lambdas/*/test/index.test.ts`

**Example**:
```typescript
describe('calculateDiscount', () => {
  test('applies 15% discount for premium users', () => {
    expect(calculateDiscount(100, true)).toBe(85)
  })

  test('no discount for regular users', () => {
    expect(calculateDiscount(100, false)).toBe(100)
  })
})
```

### Integration Tests

**Purpose**: Test multi-service workflows end-to-end

**Characteristics**:
- Use real AWS services (via LocalStack)
- Test YOUR orchestration, state management, error handling
- Test service interactions and data flow
- Coverage of vendor wrappers is a SIDE EFFECT, not the goal
- Located in: `test/integration/workflows/*.workflow.integration.test.ts`

**Example**:
```typescript
describe('Download Workflow', () => {
  test('complete download updates DynamoDB and notifies user', async () => {
    // Test YOUR workflow orchestration
    await triggerDownload(fileId)

    // Verify YOUR state management
    const file = await getFileFromDB(fileId)
    expect(file.status).toBe('downloaded')

    // Verify YOUR notification logic
    expect(notificationSent).toBe(true)
  })
})
```

## Workflow-Based Integration Testing

Prioritize integration tests by workflow complexity:

### High Priority (Multi-Service Workflows)

Test complete end-to-end workflows:
- ✅ webhook → DynamoDB → queue → Lambda → S3
- ✅ State transitions across services (pending → downloading → downloaded)
- ✅ Error rollback logic (S3 failure → DynamoDB update to "failed")
- ✅ Fan-out patterns (one Lambda invoking multiple others)
- ✅ Cross-service error handling and retries

### Medium Priority (Single Service + Logic)

Test service usage with business logic:
- ✅ Query filtering and pagination
- ✅ Presigned URL generation with validation
- ✅ Conditional creates and updates
- ✅ Batch operations with partial failures

### Low Priority (Simple CRUD)

Don't write integration tests just for coverage:
- ❌ Pure CRUD with no orchestration → Unit tests sufficient
- ❌ Simple read operations → No integration test needed
- ❌ Thin wrappers around AWS SDK → Covered by unit tests

## Coverage Targets

### Unit Test Coverage

**YOUR application logic**:
- Lambda handlers: **80%+** coverage
- Utility functions: **90%+** coverage
- Business logic: **85%+** coverage
- Error paths: **75%+** coverage

**NOT library code**:
- Vendor wrappers: Ignore in unit tests (use `/* c8 ignore */`)
- AWS SDK calls: Mocked, not measured
- External APIs: Mocked, not measured

### Integration Test Coverage

**Coverage happens naturally**:
- Vendor wrappers get exercised by workflow tests
- Don't write integration tests to hit coverage targets
- Don't write shallow "library behavior" tests
- Coverage is a side effect of workflow testing

**Success Metric**: Coverage of YOUR CODE, not library code

## What to Test

### ✅ DO Test

**Business Logic**:
- Data transformations
- Validation rules
- Calculation logic
- State transitions
- Error handling paths

**Orchestration**:
- Service call sequences
- Data flow between services
- Error recovery workflows
- Retry logic
- Rollback mechanisms

**Edge Cases**:
- Boundary conditions
- Invalid inputs
- Missing data
- Race conditions
- Partial failures

### ❌ DON'T Test

**Library Behavior**:
- AWS SDK functionality
- NPM package behavior
- Node.js built-ins
- External API contracts

**Implementation Details**:
- Internal variable names
- Private function calls
- Mock implementation
- Code formatting

## Testing Patterns

### Test YOUR Orchestration

```typescript
// ✅ GOOD - Tests YOUR workflow
test('download workflow completes end-to-end', async () => {
  // Given: File needs downloading
  await createFile(fileId, 'pending')

  // When: Workflow executes
  await startDownload(fileId)
  await processDownload(fileId)

  // Then: YOUR state management works
  const file = await getFile(fileId)
  expect(file.status).toBe('downloaded')
  expect(file.s3Key).toBeTruthy()

  // And: YOUR notification logic works
  const notifications = await getNotifications(userId)
  expect(notifications).toHaveLength(1)
})
```

### Test YOUR Error Handling

```typescript
// ✅ GOOD - Tests YOUR error recovery
test('S3 upload failure rolls back DynamoDB state', async () => {
  // Given: Upload will fail
  mockS3ToFail()

  // When: Download attempts
  await expect(processDownload(fileId)).rejects.toThrow()

  // Then: YOUR rollback logic works
  const file = await getFile(fileId)
  expect(file.status).toBe('failed')
  expect(file.errorMessage).toContain('S3 upload failed')
})
```

### DON'T Test Library Behavior

```typescript
// ❌ BAD - Tests AWS SDK, not YOUR code
test('S3 upload succeeds', async () => {
  await s3Client.send(new PutObjectCommand({...}))
  // This tests AWS SDK, not your business logic
})

// ✅ GOOD - Tests YOUR upload orchestration
test('file upload updates metadata', async () => {
  await uploadFileWithMetadata(fileId, data)

  const file = await getFile(fileId)
  expect(file.uploadedAt).toBeTruthy()
  expect(file.size).toBe(data.length)
})
```

## Coverage as a Side Effect

### The Right Mindset

```
Write tests for business value
    ↓
Tests exercise your code
    ↓
Coverage happens naturally
    ↓
Coverage report confirms thoroughness
```

### The Wrong Mindset

```
Coverage report shows 70%
    ↓
Write tests to hit 80%
    ↓
Tests don't verify business logic
    ↓
False sense of security
```

## Ignoring Vendor Wrappers in Unit Tests

### Mark Vendor Code for Ignore

```typescript
// lib/vendor/AWS/S3.ts

/* c8 ignore start */
export async function createS3Upload(
  bucket: string,
  key: string,
  body: any,
  contentType: string
) {
  // Vendor wrapper - tested via integration tests
  const upload = new Upload({
    client: s3Client,
    params: {Bucket: bucket, Key: key, Body: body, ContentType: contentType}
  })
  return upload
}
/* c8 ignore end */
```

**Why**: Vendor wrappers are thin wrappers around AWS SDK. Testing them in unit tests means testing AWS SDK behavior. They get exercised naturally in integration tests.

## Integration Test Organization

Structure integration tests by workflow, not by service:

```
test/integration/
├── workflows/
│   ├── webhookFeedly.workflow.integration.test.ts
│   ├── fileDownload.workflow.integration.test.ts
│   ├── deviceRegistration.workflow.integration.test.ts
│   └── userFileAssociation.workflow.integration.test.ts
├── fixtures/
│   └── testData.ts
└── setup/
    └── localstack.ts
```

**Not by service**:
```
❌ test/integration/
   ├── s3/
   ├── dynamodb/
   ├── lambda/
   └── sns/
```

**Why**: Workflows test real business scenarios, services don't.

## Success Criteria

### Good Test Suite Indicators

✅ Tests describe business requirements
✅ Tests fail when business logic breaks
✅ Tests don't fail when AWS SDK updates
✅ High coverage of YOUR code
✅ Low coverage of library code (ignored)
✅ Fast unit tests (< 1s total)
✅ Reasonable integration tests (< 30s total)

### Bad Test Suite Indicators

❌ Tests describe implementation details
❌ Tests pass despite broken business logic
❌ Tests break when refactoring (without behavior change)
❌ High coverage via shallow tests
❌ Coverage of library behavior
❌ Slow unit tests (> 5s total)
❌ Many integration tests for simple CRUD

## Common Mistakes

### Mistake 1: Testing Libraries

```typescript
// ❌ WRONG - Testing DynamoDB SDK
test('DynamoDB query returns items', async () => {
  const result = await dynamoDb.query({...})
  expect(result.Items).toBeDefined()
})

// ✅ CORRECT - Testing YOUR query logic
test('getUserFiles returns only active files', async () => {
  const files = await getUserFiles(userId)
  expect(files.every(f => f.status === 'active')).toBe(true)
})
```

### Mistake 2: Coverage-Driven Testing

```typescript
// ❌ WRONG - Writing tests just for coverage
test('function exists', () => {
  expect(myFunction).toBeDefined()
})

test('function returns something', () => {
  expect(myFunction()).toBeTruthy()
})

// ✅ CORRECT - Testing business requirements
test('premium users get 15% discount', () => {
  expect(calculatePrice(100, {isPremium: true})).toBe(85)
})
```

### Mistake 3: Shallow Integration Tests

```typescript
// ❌ WRONG - Just testing SDK works
test('can write to S3', async () => {
  await uploadToS3('test-bucket', 'key', 'data')
  // This tests AWS SDK, not your logic
})

// ✅ CORRECT - Testing YOUR workflow
test('file upload triggers processing workflow', async () => {
  await uploadFile(fileId, data)

  // Verify YOUR state management
  const file = await getFile(fileId)
  expect(file.status).toBe('processing')

  // Verify YOUR workflow triggered
  const processingJob = await getProcessingJob(fileId)
  expect(processingJob).toBeDefined()
})
```

## Related Patterns

- [Jest ESM Mocking Strategy](Jest-ESM-Mocking-Strategy.md) - How to mock dependencies
- [Mock Type Annotations](Mock-Type-Annotations.md) - Type-safe mocking
- [Integration Testing](Integration-Testing.md) - LocalStack patterns
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - What to test in Lambdas

---

*Test YOUR code, not library code. Coverage should be a side effect of testing business logic, not a goal. Focus on workflows, orchestration, and business rules.*