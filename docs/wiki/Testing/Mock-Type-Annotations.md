# Mock Type Annotations

## Quick Reference
- **When to use**: Creating mock functions with jest.fn()
- **Enforcement**: Required - provides type safety in tests
- **Impact if violated**: Medium - loss of type safety, harder debugging

## The Rule

Use **specific type annotations** for `jest.fn()` when using `mockResolvedValue` or `mockReturnValue`. Avoid generic types like `unknown` or `any`. Never use type escape hatches like `as any` or `as unknown`.

## Type Annotation Policy

### ❌ AVOID Generic Type Annotations

```typescript
// ❌ DON'T - `unknown` and `any` provide no type safety
const sendMock = jest.fn<() => Promise<unknown>>()
const updateMock = jest.fn<() => Promise<any>>()
const resultMock = jest.fn<() => any>()
```

**Why**: These provide no type safety and defeat the purpose of using TypeScript in tests.

### ❌ NEVER Use Type Escape Hatches

```typescript
// ❌ ABSOLUTELY FORBIDDEN - defeats the entire purpose of TypeScript
const queryMock = jest.fn() as any
const batchGetMock = jest.fn() as unknown

// ❌ FORBIDDEN - even for "just testing" or "quick fixes"
const result = data as any
const value = response as unknown as MyType
const mockFn = jest.fn() as jest.Mock<any, any>
```

**Why**: Type assertions like `as any` remove all type checking and hide bugs.

### ✅ USE Specific Type Annotations

When using `mockResolvedValue` or `mockReturnValue`:

```typescript
// ✅ DO - specific return shapes for AWS responses
const sendMock = jest.fn<() => Promise<{StatusCode: number}>>()
  .mockResolvedValue({StatusCode: 202})

const updateMock = jest.fn<() => Promise<Record<string, unknown>>>()
  .mockResolvedValue({})

const headObjectMock = jest.fn<() => Promise<{ContentLength: number}>>()
  .mockResolvedValue({ContentLength: 1024})
```

### ✅ USE Domain-Specific Types

```typescript
// ✅ DO - provides meaningful type safety for domain models
import type {YtDlpVideoInfo, YtDlpFormat} from '../../../types/ytdlp'

const fetchVideoInfoMock = jest.fn<() => Promise<YtDlpVideoInfo>>()
  .mockResolvedValue({
    id: 'video-123',
    title: 'Test Video',
    formats: []
  })

const chooseFormatMock = jest.fn<() => YtDlpFormat>()
  .mockReturnValue({
    format_id: 'best',
    ext: 'mp4',
    filesize: 1024000
  })
```

### ✅ OMIT Type Annotations for Simple Mocks

When NOT using `mockResolvedValue` or `mockReturnValue`:

```typescript
// ✅ DO - TypeScript can infer from usage
const logDebugMock = jest.fn()
const spawnMock = jest.fn()
const callbackMock = jest.fn()
```

**Why**: TypeScript can infer the type from how the mock is used in tests.

### ⚠️ USE Promise<void> for mockResolvedValue(undefined)

```typescript
// ✅ DO - Promise<void> required for mockResolvedValue(undefined)
const copyFileMock = jest.fn<() => Promise<void>>()
  .mockResolvedValue(undefined)

const deleteMock = jest.fn<() => Promise<void>>()
  .mockResolvedValue(undefined)

// ❌ WRONG - TypeScript error
const copyFileMock = jest.fn<() => Promise<undefined>>()
  .mockResolvedValue(undefined)
```

## Common Patterns

### AWS SDK Client Mocks

Require full type annotations for proper client structure:

```typescript
jest.unstable_mockModule('@aws-sdk/client-lambda', () => ({
  LambdaClient: jest.fn<() => {send: jest.Mock<() => Promise<{StatusCode: number}>>}>()
    .mockImplementation(() => ({
      send: jest.fn<() => Promise<{StatusCode: number}>>()
        .mockResolvedValue({StatusCode: 202})
    })),
  InvokeCommand: jest.fn()
}))
```

### Vendor Wrapper Mocks

```typescript
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({
  headObject: jest.fn<() => Promise<{ContentLength: number; ETag: string}>>()
    .mockResolvedValue({
      ContentLength: 1024,
      ETag: '"abc123"'
    }),

  createS3Upload: jest.fn<() => Promise<{done: () => Promise<void>}>>()
    .mockResolvedValue({
      done: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    })
}))
```

### NPM Package Mocks

```typescript
// Class constructor mock
class MockYTDlpWrap {
  constructor(public binaryPath: string) {}

  getVideoInfo = jest.fn<() => Promise<{
    id: string
    title: string
    formats: Array<{format_id: string}>
  }>>().mockResolvedValue({
    id: 'video-123',
    title: 'Test',
    formats: [{format_id: 'best'}]
  })
}

jest.unstable_mockModule('yt-dlp-wrap', () => ({
  default: MockYTDlpWrap
}))
```

### Node Built-in Mocks

```typescript
// No type annotations needed - simple functions
jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn()
}))

jest.unstable_mockModule('fs/promises', () => ({
  copyFile: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  readFile: jest.fn<() => Promise<Buffer>>(),
  writeFile: jest.fn<() => Promise<void>>()
}))
```

## Benefits of Specific Types

### 1. Type Safety in Tests

```typescript
// ✅ TypeScript catches mistakes
const mockFn = jest.fn<() => Promise<{ContentLength: number}>>()
  .mockResolvedValue({ContentLength: 1024})

// This would be a TypeScript error:
// mockFn.mockResolvedValue({ContentLenght: 1024})  // Typo caught!
//                          ^^^^^^^^^^^^
```

### 2. IntelliSense Support

```typescript
const mockFn = jest.fn<() => Promise<{id: string; name: string}>>()
  .mockResolvedValue({
    id: 'test-id',
    name: 'test-name'
    // IntelliSense shows available properties
  })
```

### 3. Refactoring Safety

When return types change, TypeScript errors guide you to update all mocks:

```typescript
// Function signature changes from:
// function getUser(): Promise<{name: string}>
// to:
// function getUser(): Promise<{name: string; email: string}>

// TypeScript error tells you to update mock:
const getUserMock = jest.fn<() => Promise<{name: string; email: string}>>()
  .mockResolvedValue({
    name: 'Test',
    email: 'test@example.com'  // Now required
  })
```

### 4. Better Error Messages

```typescript
// With specific types
const mockFn = jest.fn<() => Promise<{count: number}>>()
  .mockResolvedValue({conut: 5})  // TypeScript error with exact property name

// With generic types
const mockFn = jest.fn<() => Promise<any>>()
  .mockResolvedValue({conut: 5})  // No error, bug in production
```

## When to Use Each Pattern

### Use Specific Type Annotation When:
- Mock returns a value (`mockResolvedValue`, `mockReturnValue`)
- Function has well-defined return type
- Testing domain-specific types
- Mocking AWS SDK responses
- Return type is object with multiple properties

### Omit Type Annotation When:
- Mock is simple callback
- TypeScript can infer from usage
- Mock doesn't return a value
- Function is void or returns undefined
- Testing side effects only

### Use Domain Type When:
- Type is defined in your codebase
- Type represents business domain
- Multiple mocks share same type
- Type is complex or nested

## Anti-Patterns to Avoid

### Anti-Pattern 1: Generic Unknown

```typescript
// ❌ WRONG - Provides no type safety
const mockFn = jest.fn<() => Promise<unknown>>()
  .mockResolvedValue({anything: 'goes'})

// ✅ CORRECT - Specific shape
const mockFn = jest.fn<() => Promise<{userId: string; status: string}>>()
  .mockResolvedValue({userId: '123', status: 'active'})
```

### Anti-Pattern 2: Type Assertion

```typescript
// ❌ WRONG - Defeats TypeScript
const mockFn = jest.fn() as jest.Mock<Promise<UserData>>

// ✅ CORRECT - Proper type annotation
const mockFn = jest.fn<() => Promise<UserData>>()
```

### Anti-Pattern 3: Overly Complex Types

```typescript
// ❌ WRONG - Too complex, hard to maintain
const mockFn = jest.fn<(a: string, b: number, c: {d: boolean, e: string[]}) => Promise<{f: number, g: {h: string}}>>()

// ✅ CORRECT - Extract type definition
type MockParams = {userId: string; count: number; options: UserOptions}
type MockReturn = {success: boolean; data: UserData}

const mockFn = jest.fn<(params: MockParams) => Promise<MockReturn>>()
```

### Anti-Pattern 4: Duplicate Type Definitions

```typescript
// ❌ WRONG - Duplicating types
const mock1 = jest.fn<() => Promise<{id: string; name: string}>>()
const mock2 = jest.fn<() => Promise<{id: string; name: string}>>()

// ✅ CORRECT - Reuse type
import type {UserInfo} from '../../../types/user'

const mock1 = jest.fn<() => Promise<UserInfo>>()
const mock2 = jest.fn<() => Promise<UserInfo>>()
```

## Migration Guide

### Step 1: Identify Generic Mocks

```bash
# Find potentially problematic mocks
grep -r "jest.fn<.*unknown.*>" test/ --include="*.ts"
grep -r "jest.fn<.*any.*>" test/ --include="*.ts"
grep -r "as any" test/ --include="*.ts"
```

### Step 2: Determine Correct Type

Look at the mock's usage:
```typescript
// Current (bad)
const mockFn = jest.fn() as any

// Find usage
mockFn.mockResolvedValue({id: '123', name: 'Test'})

// Update with inferred type
const mockFn = jest.fn<() => Promise<{id: string; name: string}>>()
```

### Step 3: Update Mock Declaration

```typescript
// Before
const getUserMock = jest.fn().mockResolvedValue({id: '123'})

// After
const getUserMock = jest.fn<() => Promise<{id: string}>>()
  .mockResolvedValue({id: '123'})
```

### Step 4: Import Types if Needed

```typescript
// If type exists
import type {User} from '../../../types/user'

const getUserMock = jest.fn<() => Promise<User>>()
  .mockResolvedValue({
    id: '123',
    name: 'Test User',
    email: 'test@example.com'
  })
```

## Testing Guidelines

### Test the Mock Type

```typescript
// Ensure mock matches actual function signature
import type {getUserById} from '../../../lib/userService'

// Mock should match the function type
const getUserByIdMock = jest.fn<typeof getUserById>()
```

### Verify Mock Calls

```typescript
const mockFn = jest.fn<(id: string) => Promise<{name: string}>>()

// TypeScript ensures correct call signature
expect(mockFn).toHaveBeenCalledWith('user-123')
// expect(mockFn).toHaveBeenCalledWith(123)  // TypeScript error if number
```

## Related Patterns

- [Jest ESM Mocking Strategy](Jest-ESM-Mocking-Strategy.md) - When and what to mock
- [Coverage Philosophy](Coverage-Philosophy.md) - Testing principles
- [AWS SDK Encapsulation](../AWS/SDK-Encapsulation-Policy.md) - Mock wrappers not SDK
- [Type Definitions](../TypeScript/Type-Definitions.md) - Where to define types

---

*Use specific type annotations for mocks to maintain type safety throughout your test suite. Avoid `any`, `unknown`, and type assertions. Let TypeScript help you write correct tests.*