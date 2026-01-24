# Failure Scenario Testing

## Quick Reference
- **When to use**: Testing error handling and resilience
- **Enforcement**: Recommended for critical paths
- **Impact if violated**: LOW - Error paths untested

## Overview

Failure scenario tests verify the system handles errors gracefully. These tests use real LocalStack and PostgreSQL services with controlled failure injection.

## Test Files

| File | Category | Purpose |
|------|----------|---------|
| `database.failure.integration.test.ts` | Database | Error handling for database operations |
| `externalServices.failure.integration.test.ts` | External Services | Error handling for AWS services |

## Database Failure Scenarios

**File**: `test/integration/workflows/failures/database.failure.integration.test.ts`

### Entity Not Found Scenarios

| Scenario | Lambda | Expected Behavior |
|----------|--------|-------------------|
| File not found | S3ObjectCreated | Returns gracefully, no crash |
| User not found | ListFiles | Returns 200 with empty keyCount |

### Constraint Violation Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Duplicate user-file association | Throws duplicate key error |
| Duplicate device registration | Handles idempotently |

### Cascade Deletion Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| User deletion integrity | Maintains database consistency |
| Orphaned associations | Handles gracefully |

### Transaction Boundary Tests

| Scenario | Expected Behavior |
|----------|-------------------|
| Partial data setup | Handles incomplete data |

## External Services Failure Scenarios

**File**: `test/integration/workflows/failures/externalServices.failure.integration.test.ts`

### SNS Endpoint Failures

| Scenario | Expected Behavior |
|----------|-------------------|
| Deleted endpoint | Handles gracefully |
| Individual endpoint failure in batch | Continues processing other devices |

### SQS Message Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| Queue not found | Handles error |
| Malformed message body | Returns without throwing |
| Empty SQS batch | Returns defined result |

### Partial Batch Failures

| Scenario | Expected Behavior |
|----------|-------------------|
| Mixed success/failure | Reports partial failures correctly |
| Individual item failure | Doesn't fail entire batch |

### Service Configuration Errors

| Scenario | Expected Behavior |
|----------|-------------------|
| Missing environment variables | Fails fast |
| Invalid ARN format | Returns 400+ status code |

### Timeout and Retry Behavior

| Scenario | Expected Behavior |
|----------|-------------------|
| Operation timeout | Throws timeout error |

## Coverage Gaps

The following failure scenarios are NOT currently tested:

### Database Gaps

| Scenario | Priority | Reason Not Tested |
|----------|----------|-------------------|
| Connection timeout | Medium | Complex to simulate reliably |
| Transaction rollback | Medium | Requires specific failure injection |
| Connection pool exhaustion | Low | Would require large parallel load |

### AWS Service Gaps

| Scenario | Priority | Reason Not Tested |
|----------|----------|-------------------|
| SQS Dead Letter Queue | Medium | Requires DLQ configuration in LocalStack |
| S3 upload failure | Medium | Complex to simulate mid-upload failure |
| EventBridge rule failure | Low | LocalStack limitation |

### External Service Gaps

| Scenario | Priority | Reason Not Tested |
|----------|----------|-------------------|
| APNS connection failure | Low | APNS is always mocked |
| YouTube download failure | Medium | yt-dlp is mocked in tests |

## Writing Failure Tests

### Pattern: Controlled Failure Injection

```typescript
test('should handle deleted endpoint gracefully', async () => {
  // 1. Create real resources
  const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)
  await insertDevice({deviceId, endpointArn})

  // 2. Inject failure by deleting resource
  await deleteTestEndpoint(endpointArn)

  // 3. Execute operation that uses deleted resource
  const result = await handler(event, context)

  // 4. Verify graceful handling
  expect(result).toBeDefined()
})
```

### Pattern: Partial Batch Failure

```typescript
test('should not fail entire batch when individual item fails', async () => {
  const results = await Promise.allSettled([
    Promise.resolve('success1'),
    Promise.reject(new Error('Individual failure')),
    Promise.resolve('success2')
  ])

  const fulfilled = results.filter((r) => r.status === 'fulfilled')
  const rejected = results.filter((r) => r.status === 'rejected')

  expect(fulfilled.length).toBe(2)
  expect(rejected.length).toBe(1)
})
```

### Pattern: Missing Configuration

```typescript
test('should fail fast on missing required environment variables', async () => {
  const original = process.env.REQUIRED_VAR
  delete process.env.REQUIRED_VAR

  try {
    // Test should detect missing config
    expect(true).toBe(true) // Placeholder for actual assertion
  } finally {
    process.env.REQUIRED_VAR = original // Always restore
  }
})
```

## Best Practices

1. **Always clean up** - Use try/finally to restore environment variables
2. **Use real services** - Don't mock AWS services that LocalStack emulates
3. **Test both success and failure paths** - Ensure error doesn't crash
4. **Verify error messages** - Check error contains useful information
5. **Test partial failures** - Ensure batch operations handle individual failures

## Related Patterns

- [LocalStack Testing](./LocalStack-Testing.md) - LocalStack setup and patterns
- [Integration Testing](./Integration-Testing.md) - General integration test patterns
- [Vitest Mocking Strategy](./Vitest-Mocking-Strategy.md) - When mocking is acceptable
