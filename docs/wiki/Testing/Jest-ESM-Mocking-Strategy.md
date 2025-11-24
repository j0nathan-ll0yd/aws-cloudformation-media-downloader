# Jest ESM Mocking Strategy

## Quick Reference
- **When to use**: Writing tests for any TypeScript module using ES modules
- **Enforcement**: Required - prevents obscure test failures
- **Impact if violated**: HIGH - Tests fail with confusing 500 errors despite working code

## The Problem Solved

Tests can fail with obscure 500 errors despite code working perfectly in production. The root cause: **missing mocks for transitive dependencies**.

## The Core Issue: Module-Level Imports

In ES modules with Jest, **ALL module-level code executes when ANY function from that module is imported**.

### Example

```typescript
// YouTube.ts
import YTDlpWrap from 'yt-dlp-wrap'        // ← Executes even if you only import getVideoID()
import {spawn} from 'child_process'        // ← Executes
import {Upload} from '@aws-sdk/lib-storage' // ← Executes (violation, but example)

export function getVideoID(url: string) { /* ... */ }  // ← What you actually imported
export function streamVideoToS3() { /* uses all the above */ }
```

When a test imports `getVideoID`:
1. The entire YouTube module loads
2. ALL imports execute at module level
3. ALL constructors and top-level code runs
4. If ANY dependency isn't mocked → Test fails with obscure error

**Solution**: Mock ALL transitive dependencies, not just what you think you're using.

## Mandatory Testing Checklist

**For EVERY new test file:**

- [ ] **Step 1**: List all direct imports in the test
- [ ] **Step 2**: Read each source file and list its imports
- [ ] **Step 3**: Recursively map transitive dependencies (imports of imports)
- [ ] **Step 4**: Mock ALL external dependencies BEFORE importing handler
- [ ] **Step 5**: Verify mocks match module structure (classes vs functions)
- [ ] **Step 6**: Add proper TypeScript types to mocks (especially SDK clients)
- [ ] **Step 7**: Test locally AND in CI

## Dependency Mapping Process

### Step 1: Identify Test Imports

```typescript
// test/index.test.ts
import {handler} from '../src'  // What we're testing
```

### Step 2: Read Source File

```typescript
// src/index.ts
import {getVideoID} from '../../../lib/YouTube'
import {invokeLambda} from '../../../lib/vendor/AWS/Lambda'
import {validateInput} from '../../../util/validators'
```

### Step 3: Map Transitive Dependencies

```typescript
// lib/YouTube.ts imports:
- yt-dlp-wrap (NPM package)
- child_process (Node built-in)
- fs/promises (Node built-in)
- ../vendor/AWS/S3 (vendor wrapper)

// lib/vendor/AWS/Lambda.ts imports:
- @aws-sdk/client-lambda (AWS SDK - only allowed here)

// util/validators.ts imports:
- validate.js (NPM package)
```

### Step 4: Create Comprehensive Mock List

**Required mocks for this test:**
1. `yt-dlp-wrap` (class constructor)
2. `child_process` (Node built-in)
3. `fs/promises` (Node built-in)
4. `lib/vendor/AWS/S3` (vendor wrapper functions)
5. `lib/vendor/AWS/Lambda` (vendor wrapper functions)
6. `validate.js` (NPM package)

**NEVER mock** `@aws-sdk/*` packages directly - mock the vendor wrappers instead.

## Mock Patterns

### NPM Class Constructors

```typescript
// For packages that export classes
class MockYTDlpWrap {
  constructor(public binaryPath: string) {}
  getVideoInfo = jest.fn<() => Promise<any>>()
    .mockResolvedValue({title: 'Test Video'})
}

jest.unstable_mockModule('yt-dlp-wrap', () => ({
  default: MockYTDlpWrap  // Must be actual class, not jest.fn()
}))
```

### NPM Function Exports

```typescript
jest.unstable_mockModule('validate', () => ({
  validate: jest.fn().mockReturnValue(undefined),  // undefined = valid
  single: jest.fn()
}))
```

### Node.js Built-ins

```typescript
// child_process
jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn()
}))

// fs/promises
jest.unstable_mockModule('fs/promises', () => ({
  copyFile: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  readFile: jest.fn<() => Promise<Buffer>>(),
  writeFile: jest.fn<() => Promise<void>>()
}))
```

### Vendor Wrappers (NOT AWS SDK)

```typescript
// ✅ CORRECT - Mock vendor wrapper
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({
  headObject: jest.fn<() => Promise<{ContentLength: number}>>()
    .mockResolvedValue({ContentLength: 1024}),
  createS3Upload: jest.fn<() => Promise<{done: () => Promise<void>}>>()
    .mockResolvedValue({
      done: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    })
}))

// ❌ WRONG - Never mock AWS SDK directly
jest.unstable_mockModule('@aws-sdk/client-s3', () => ({...}))
```

### AWS SDK Clients (in Vendor Wrappers Only)

```typescript
// Only when testing vendor wrapper files themselves
jest.unstable_mockModule('@aws-sdk/client-lambda', () => ({
  LambdaClient: jest.fn<() => {send: jest.Mock<() => Promise<{StatusCode: number}>>}>()
    .mockImplementation(() => ({
      send: jest.fn<() => Promise<{StatusCode: number}>>()
        .mockResolvedValue({StatusCode: 202})
    })),
  InvokeCommand: jest.fn()
}))
```

## Complete Test Example

### Transitive Dependency Chain

```
Test → handler → getVideoID() from YouTube.ts
                          → initiateFileDownload() from shared.ts

YouTube.ts imports:
  - yt-dlp-wrap
  - child_process
  - fs/promises
  - vendor/AWS/S3

shared.ts imports:
  - vendor/AWS/Lambda
  - vendor/AWS/DynamoDB
```

### Required Mocks (ALL of these)

```typescript
// test/index.test.ts

// 1. YouTube.ts dependencies (external packages)
class MockYTDlpWrap {
  constructor(public binaryPath: string) {}
  getVideoInfo = jest.fn<() => Promise<any>>().mockResolvedValue({
    title: 'Test Video',
    url: 'https://example.com/video'
  })
}

jest.unstable_mockModule('yt-dlp-wrap', () => ({
  default: MockYTDlpWrap
}))

jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn()
}))

jest.unstable_mockModule('fs/promises', () => ({
  copyFile: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
}))

// 2. YouTube.ts dependencies (vendor wrappers)
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({
  headObject: jest.fn<() => Promise<{ContentLength: number}>>()
    .mockResolvedValue({ContentLength: 1024}),
  createS3Upload: jest.fn<() => Promise<{done: () => Promise<void>}>>()
    .mockResolvedValue({
      done: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    })
}))

// 3. shared.ts dependencies (vendor wrappers)
jest.unstable_mockModule('../../../lib/vendor/AWS/Lambda', () => ({
  invokeLambda: jest.fn<() => Promise<{StatusCode: number}>>()
    .mockResolvedValue({StatusCode: 202})
}))

// 3a. ElectroDB entities (use the mock helper!)
import {createElectroDBEntityMock} from '../../../../test/helpers/electrodb-mock'

const filesMock = createElectroDBEntityMock({queryIndexes: ['byStatus']})
const userFilesMock = createElectroDBEntityMock({queryIndexes: ['byUser']})

jest.unstable_mockModule('../../../entities/Files', () => ({
  Files: filesMock.entity
}))
jest.unstable_mockModule('../../../entities/UserFiles', () => ({
  UserFiles: userFilesMock.entity
}))

// Usage in tests:
filesMock.mocks.get.mockResolvedValue({data: fileData})
userFilesMock.mocks.query.byUser!.go.mockResolvedValue({data: userFiles})

// 4. CloudWatch vendor wrapper (used by util/lambda-helpers)
jest.unstable_mockModule('../../../lib/vendor/AWS/CloudWatch', () => ({
  putMetricData: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  getStandardUnit: (unit?: string) => unit || 'None'
}))

// THEN import the handler (after all mocks)
const {handler} = await import('../src')

// Now tests can run without module-level execution failures
```

## Fixture Management

### Loading JSON Fixtures

Always use dynamic imports with JSON assertion for fixtures:

```typescript
// ✅ CORRECT - Dynamic import with JSON assertion
const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {default: queryResponse} = await import('./fixtures/query-200-OK.json', {assert: {type: 'json'}})

// ❌ WRONG - Static import (breaks Jest ESM)
import eventMock from './fixtures/APIGatewayEvent.json'

// ❌ WRONG - Missing JSON assertion
const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json')
```

### Fixture Organization

```
test/
├── fixtures/
│   ├── APIGatewayEvent.json        # API Gateway event mocks
│   ├── query-200-OK.json           # DynamoDB query responses
│   ├── S3Event.json                # S3 event notifications
│   └── user-data.json              # Test user data
└── index.test.ts
```

### Cloning Fixtures

Always deep clone fixtures to prevent test pollution:

```typescript
let event: CustomAPIGatewayRequestAuthorizerEvent

beforeEach(() => {
  // Deep clone to prevent test pollution
  event = JSON.parse(JSON.stringify(eventMock))
})
```

## Test Naming: Use-Case Focused vs Implementation-Focused

**CRITICAL**: Test descriptions MUST focus on the behavior being tested, NOT the implementation details.

### ❌ BAD: Implementation-Focused Descriptions

These descriptions expose internal implementation and become outdated when refactoring:

```typescript
// DON'T describe which service/method is being called
test('ElectroDB UserFiles.query.byUser', async () => {})
test('ElectroDB Files.get (batch)', async () => {})
test('AWS.DynamoDB.DocumentClient.query', async () => {})
test('getUserDevices fails', async () => {})
```

**Problems**:
- Break when you refactor from DynamoDB to ElectroDB
- Break when you change from single to batch operations
- Don't explain what scenario is being tested
- Couple tests to implementation details

### ✅ GOOD: Use-Case Focused Descriptions

These descriptions explain what scenario is being tested and what outcome is expected:

```typescript
// DO describe the scenario and expected behavior
test('should return empty list when user has no files', async () => {})
test('should return 500 error when batch file retrieval fails', async () => {})
test('should throw error when API key retrieval fails', async () => {})
test('should throw error when usage plan retrieval fails', async () => {})
test('should return 500 error when user device retrieval fails', async () => {})
```

**Benefits**:
- Survive refactoring (DynamoDB → ElectroDB doesn't change test name)
- Self-documenting (explain what is being tested)
- Focus on behavior, not implementation
- Tests remain valid even when implementation changes

### Key Principle

**Test WHAT your code does, not HOW it does it.**

Your test names should describe:
- The scenario being tested
- The expected outcome
- The error condition (if testing failures)

They should NOT describe:
- Which library/SDK is used
- Which specific method is called
- Internal implementation details

## ElectroDB Entity Mocking

**CRITICAL**: Always use the `createElectroDBEntityMock` helper for mocking ElectroDB entities.

### Why Use the Helper?

1. **Type Safety**: Provides correct TypeScript types for all operations
2. **Consistency**: One mocking pattern across all tests
3. **Completeness**: Includes all ElectroDB operations (get, scan, query, create, upsert, update, delete)
4. **Maintainability**: Changes to ElectroDB only require updating the helper

### Example Usage

```typescript
import {createElectroDBEntityMock} from '../../../../test/helpers/electrodb-mock'

// Create mocks for each entity
const filesMock = createElectroDBEntityMock({queryIndexes: ['byStatus']})
const usersMock = createElectroDBEntityMock()
const collectionsMock = createElectroDBEntityMock()

// Mock the entity modules
jest.unstable_mockModule('../../../entities/Files', () => ({
  Files: filesMock.entity
}))
jest.unstable_mockModule('../../../entities/Users', () => ({
  Users: usersMock.entity
}))
jest.unstable_mockModule('../../../entities/Collections', () => ({
  collections: collectionsMock.entity
}))

// In your tests, set return values
beforeEach(() => {
  filesMock.mocks.get.mockResolvedValue({data: testFile})
  filesMock.mocks.query.byStatus!.go.mockResolvedValue({data: [testFile]})
  usersMock.mocks.create.mockResolvedValue({data: testUser})
})
```

### Available Operations

- **get**: `mocks.get.mockResolvedValue({data: item})`
- **scan**: `mocks.scan.go.mockResolvedValue({data: items})`
- **query**: `mocks.query.byIndexName!.go.mockResolvedValue({data: items})`
- **create**: `mocks.create.mockResolvedValue({data: item})`
- **upsert**: `mocks.upsert.go.mockResolvedValue({data: item})`
- **update**: `mocks.update.go.mockResolvedValue({data: item})`
- **delete**: `mocks.delete.mockResolvedValue(undefined)`

## Common Mistakes

### Mistake 1: Partial Mocking

```typescript
// ❌ WRONG - Only mocking what test directly uses
jest.unstable_mockModule('../../../lib/YouTube', () => ({
  getVideoID: jest.fn()  // Missing YouTube's dependencies!
}))

// ✅ CORRECT - Mock YouTube's dependencies too
jest.unstable_mockModule('yt-dlp-wrap', () => ({...}))
jest.unstable_mockModule('child_process', () => ({...}))
// ... all of YouTube's imports
```

### Mistake 2: Mocking After Import

```typescript
// ❌ WRONG - Import before mocks
import {handler} from '../src'
jest.unstable_mockModule('yt-dlp-wrap', () => ({...}))

// ✅ CORRECT - Mocks before import
jest.unstable_mockModule('yt-dlp-wrap', () => ({...}))
const {handler} = await import('../src')
```

### Mistake 3: Mocking AWS SDK Directly

```typescript
// ❌ WRONG - Violates SDK Encapsulation Policy
jest.unstable_mockModule('@aws-sdk/client-s3', () => ({...}))

// ✅ CORRECT - Mock vendor wrapper
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({...}))
```

### Mistake 4: No Type Annotations

```typescript
// ❌ WRONG - No type safety
const mockFn = jest.fn()

// ✅ CORRECT - Specific return type
const mockFn = jest.fn<() => Promise<{ContentLength: number}>>()
  .mockResolvedValue({ContentLength: 1024})
```

## Debugging Failed Tests

### Symptom: 500 Error with No Clear Message

**Cause**: Missing mock for transitive dependency

**Solution**:
1. Enable verbose logging: `npm test -- --verbose`
2. Check stack trace for failed module load
3. Identify missing dependency
4. Add mock for that dependency

### Symptom: "Cannot find module"

**Cause**: Mock path doesn't match import path

**Solution**:
1. Check exact import path in source file
2. Use same path in `jest.unstable_mockModule`
3. Ensure relative paths match (../../../ vs ../../)

### Symptom: "X is not a constructor"

**Cause**: Mocking class as function

**Solution**:
```typescript
// ❌ WRONG
jest.unstable_mockModule('yt-dlp-wrap', () => ({
  default: jest.fn()  // Not a constructor
}))

// ✅ CORRECT
class MockClass {
  constructor() {}
}
jest.unstable_mockModule('yt-dlp-wrap', () => ({
  default: MockClass
}))
```

## Best Practices

### 1. Map Dependencies First
Before writing test, create dependency tree on paper/doc.

### 2. Mock in Dependency Order
Mock deepest dependencies first, then work up.

### 3. Use Type Annotations
Always provide type annotations for mock functions.

### 4. Test Locally AND in CI
Some module loading issues only appear in CI environment.

### 5. Keep Mocks Simple
Mock minimal interface needed, not entire API.

### 6. Reuse Mock Patterns
Create shared mock factories for common dependencies.

## Mock Organization

### Pattern: Shared Mock Utilities

```typescript
// test/mocks/ytdlp.ts
export class MockYTDlpWrap {
  constructor(public binaryPath: string) {}
  getVideoInfo = jest.fn<() => Promise<any>>()
}

// test/index.test.ts
import {MockYTDlpWrap} from './mocks/ytdlp'

jest.unstable_mockModule('yt-dlp-wrap', () => ({
  default: MockYTDlpWrap
}))
```

## When to Mock vs Not Mock

### ✅ Always Mock
- External NPM packages
- Node.js built-ins (fs, child_process, etc.)
- Vendor wrappers (lib/vendor/AWS/*)
- Database clients
- Network requests

### ❌ Never Mock (in Application Tests)
- Your own utility functions (test them!)
- Constants
- Type definitions
- Simple data transformers

### ⚠️ Sometimes Mock
- Expensive computations (use real for most tests)
- Time-dependent functions (Date.now, setTimeout)
- Randomness (Math.random)

## Related Patterns

- [Mock Type Annotations](Mock-Type-Annotations.md) - Specific vs generic types
- [Coverage Philosophy](Coverage-Philosophy.md) - What to test
- [AWS SDK Encapsulation](../AWS/SDK-Encapsulation-Policy.md) - Never mock @aws-sdk/*
- [Lazy Initialization Pattern](Lazy-Initialization-Pattern.md) - Defer SDK clients

---

*The key insight: ES modules execute ALL imports at module level. Map the full dependency tree and mock everything external. This prevents obscure test failures and ensures reliable testing.*