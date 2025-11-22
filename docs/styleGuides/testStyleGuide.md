# Lambda Test Style Guide

This document provides quick reference for testing Lambda functions in this project. For complete patterns and detailed explanations, see the wiki.

## Wiki Standards Applied

This project follows these wiki conventions for testing:

- **[Jest ESM Mocking Strategy](../wiki/Testing/Jest-ESM-Mocking-Strategy.md)** - CRITICAL: Mock ALL transitive dependencies
- **[Mock Type Annotations](../wiki/Testing/Mock-Type-Annotations.md)** - Use specific types, avoid any/unknown
- **[Coverage Philosophy](../wiki/Testing/Coverage-Philosophy.md)** - Test YOUR code, not library code
- **[AWS SDK Encapsulation Policy](../wiki/AWS/SDK-Encapsulation-Policy.md)** - Mock vendor wrappers, NEVER AWS SDK directly

## Quick Reference

### Testing Philosophy

**Test YOUR Code, Not Library Code**

```typescript
// ❌ WRONG - Tests AWS SDK
test('S3 upload works', async () => {
  await s3Client.send(new PutObjectCommand({...}))
})

// ✅ CORRECT - Tests YOUR orchestration
test('file upload updates metadata', async () => {
  await uploadFileWithMetadata(fileId, data)

  const file = await getFile(fileId)
  expect(file.uploadedAt).toBeTruthy()
})
```

See [Coverage Philosophy](../wiki/Testing/Coverage-Philosophy.md) for details.

### Jest ESM Mocking

```typescript
// Mock vendor wrappers BEFORE importing handler
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({
  createS3Upload: jest.fn<() => Promise<{done: () => Promise<void>}>>()
    .mockResolvedValue({
      done: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    })
}))

// THEN import handler
const {handler} = await import('../src')
```

See [Jest ESM Mocking Strategy](../wiki/Testing/Jest-ESM-Mocking-Strategy.md) for complete checklist.

### Mock Type Annotations

```typescript
// ✅ GOOD - Specific types
const mockFn = jest.fn<() => Promise<{StatusCode: number}>>()
  .mockResolvedValue({StatusCode: 202})

// ❌ BAD - Generic types
const mockFn = jest.fn<() => Promise<unknown>>()

// ❌ FORBIDDEN - Type escape hatches
const mockFn = jest.fn() as any
```

See [Mock Type Annotations](../wiki/Testing/Mock-Type-Annotations.md) for patterns.

## Project-Specific Patterns

### Typical Test File Structure

```typescript
// 1. Mock vendor wrappers FIRST
jest.unstable_mockModule('../../../lib/vendor/AWS/DynamoDB', () => ({
  query: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  updateItem: jest.fn<() => Promise<Record<string, unknown>>>()
    .mockResolvedValue({})
}))

// 2. Mock CloudWatch (used by lambda-helpers)
jest.unstable_mockModule('../../../lib/vendor/AWS/CloudWatch', () => ({
  putMetricData: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  getStandardUnit: (unit?: string) => unit || 'None'
}))

// 3. Import handler AFTER mocks
const {handler} = await import('../src')

// 4. Import test utilities
import {testContext} from '../../../../util/jest-setup'
import eventMock from './fixtures/apiGatewayEvent.json'

// 5. Tests
describe('#FunctionName', () => {
  const context = testContext

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  test('should return success', async () => {
    const event = {...eventMock}
    const result = await handler(event, context)

    expect(result.statusCode).toBe(200)
  })
})
```

### Common Mock Patterns in This Project

#### DynamoDB Vendor Wrapper
```typescript
jest.unstable_mockModule('../../../lib/vendor/AWS/DynamoDB', () => ({
  query: jest.fn<() => Promise<any[]>>().mockResolvedValue([
    {id: 'file-1', status: 'active'}
  ]),
  updateItem: jest.fn<() => Promise<Record<string, unknown>>>()
    .mockResolvedValue({})
}))
```

#### S3 Vendor Wrapper
```typescript
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({
  createS3Upload: jest.fn<() => Promise<{done: () => Promise<void>}>>()
    .mockResolvedValue({
      done: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    }),
  headObject: jest.fn<() => Promise<{ContentLength: number}>>()
    .mockResolvedValue({ContentLength: 1024})
}))
```

#### Lambda Vendor Wrapper
```typescript
jest.unstable_mockModule('../../../lib/vendor/AWS/Lambda', () => ({
  invokeLambda: jest.fn<() => Promise<{StatusCode: number}>>()
    .mockResolvedValue({StatusCode: 202})
}))
```

#### CloudWatch (via lambda-helpers)
```typescript
jest.unstable_mockModule('../../../lib/vendor/AWS/CloudWatch', () => ({
  putMetricData: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  getStandardUnit: (unit?: string) => unit || 'None'
}))
```

### Test Naming Conventions

#### State-Based Tests
```typescript
test('(anonymous) should list only the default file', async () => {})
test('(authenticated) should return users files', async () => {})
test('(authenticated-first) should create endpoint', async () => {})
```

#### Action-Based Tests
```typescript
test('should handle missing bucket environment variable', async () => {})
test('should gracefully handle an empty list', async () => {})
test('should fail gracefully if query fails', async () => {})
```

### Response Testing Pattern

```typescript
const output = await handler(event, context)

// Parse response body
const body = JSON.parse(output.body)

// Verify status
expect(output.statusCode).toBe(200)

// Verify CORS headers
expect(output.headers['Access-Control-Allow-Origin']).toBe('*')

// Verify body structure
expect(body).toHaveProperty('files')
expect(body.files).toBeInstanceOf(Array)
```

## Pre-Commit Test Checklist

Before committing test code:

- [ ] All transitive dependencies mocked
- [ ] Mocks use specific type annotations (not any/unknown)
- [ ] NO `@aws-sdk/*` mocks (mock vendor wrappers instead)
- [ ] Mocks declared BEFORE handler import
- [ ] Environment variables set in `beforeEach`
- [ ] Tests describe business logic, not library behavior
- [ ] Test names indicate state or action
- [ ] All tests pass locally

## Common Mistakes

### Mistake 1: Missing Transitive Dependency Mocks
```typescript
// ❌ WRONG - Missing YouTube dependencies
jest.unstable_mockModule('../../../lib/YouTube', () => ({
  getVideoID: jest.fn()
}))
// Fails: yt-dlp-wrap, child_process, fs not mocked!

// ✅ CORRECT - All dependencies mocked
jest.unstable_mockModule('yt-dlp-wrap', () => ({ default: MockYTDlpWrap }))
jest.unstable_mockModule('child_process', () => ({ spawn: jest.fn() }))
jest.unstable_mockModule('fs/promises', () => ({ copyFile: jest.fn() }))
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({...}))
```

### Mistake 2: Mocking AWS SDK Directly
```typescript
// ❌ WRONG - Violates SDK Encapsulation
jest.unstable_mockModule('@aws-sdk/client-s3', () => ({...}))

// ✅ CORRECT - Mock vendor wrapper
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({...}))
```

### Mistake 3: Generic Type Annotations
```typescript
// ❌ WRONG - No type safety
const queryMock = jest.fn() as any

// ✅ CORRECT - Specific types
const queryMock = jest.fn<() => Promise<DynamoDBFile[]>>()
  .mockResolvedValue([])
```

### Mistake 4: Testing Library Behavior
```typescript
// ❌ WRONG - Tests DynamoDB SDK
test('DynamoDB query returns items', async () => {
  const result = await dynamoDb.query({...})
  expect(result.Items).toBeDefined()
})

// ✅ CORRECT - Tests YOUR logic
test('getUserFiles filters by status', async () => {
  const files = await getUserFiles(userId, 'active')
  expect(files.every(f => f.status === 'active')).toBe(true)
})
```

## Integration Tests

For integration testing with LocalStack, see:
- `test/integration/README.md`
- LocalStack commands: `npm run localstack:start`, `npm run test:integration`

Focus integration tests on:
- ✅ Multi-service workflows
- ✅ State transitions across services
- ✅ Error rollback logic
- ❌ NOT simple CRUD operations

## Coverage Targets

- **Lambda handlers**: 80%+ coverage
- **Utility functions**: 90%+ coverage
- **Vendor wrappers**: Ignore in unit tests (use `/* c8 ignore */`)

Coverage should be a **side effect** of testing business logic, not a goal.

## Related Documentation

- [Jest ESM Mocking Strategy](../wiki/Testing/Jest-ESM-Mocking-Strategy.md) - Complete mocking guide
- [Mock Type Annotations](../wiki/Testing/Mock-Type-Annotations.md) - Type safety patterns
- [Coverage Philosophy](../wiki/Testing/Coverage-Philosophy.md) - What to test
- [AWS SDK Encapsulation Policy](../wiki/AWS/SDK-Encapsulation-Policy.md) - Mock wrappers, not SDK

---

*This style guide is a quick reference. For complete patterns, explanations, and rationale, see the linked wiki pages above.*