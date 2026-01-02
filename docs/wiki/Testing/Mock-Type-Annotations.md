# Mock Type Annotations

## Quick Reference
- **When to use**: Creating mock functions with vi.fn()
- **Enforcement**: Required - provides type safety in tests
- **Impact if violated**: Medium - loss of type safety, harder debugging

## The Rule

Use **specific type annotations** for `vi.fn()` when using `mockResolvedValue` or `mockReturnValue`. Avoid generic types like `unknown` or `any`. Never use type escape hatches like `as any`.

## Type Annotation Policy

### ❌ AVOID Generic Types
```typescript
// ❌ DON'T - No type safety
const sendMock = vi.fn<() => Promise<unknown>>()
const updateMock = vi.fn<() => Promise<any>>()
```

### ❌ NEVER Use Type Escape Hatches
```typescript
// ❌ ABSOLUTELY FORBIDDEN
const queryMock = vi.fn() as any
const batchGetMock = vi.fn() as unknown
const mockFn = vi.fn() as Mock<any, any>
```

### ✅ USE Specific Types
```typescript
// ✅ DO - Specific return shapes
const sendMock = vi.fn<() => Promise<{StatusCode: number}>>()
  .mockResolvedValue({StatusCode: 202})

const headObjectMock = vi.fn<() => Promise<{ContentLength: number}>>()
  .mockResolvedValue({ContentLength: 1024})
```

### ✅ USE Domain Types
```typescript
import type {YtDlpVideoInfo, YtDlpFormat} from '../../../types/ytdlp'

const fetchVideoInfoMock = vi.fn<() => Promise<YtDlpVideoInfo>>()
  .mockResolvedValue({
    id: 'video-123',
    title: 'Test Video',
    formats: []
  })
```

### ✅ OMIT for Simple Mocks
```typescript
// ✅ TypeScript infers from usage
const logDebugMock = vi.fn()
const spawnMock = vi.fn()
const callbackMock = vi.fn()
```

### ⚠️ USE Promise<void> for mockResolvedValue(undefined)
```typescript
// ✅ Required for void promises
const copyFileMock = vi.fn<() => Promise<void>>()
  .mockResolvedValue(undefined)

// ❌ WRONG
const copyFileMock = vi.fn<() => Promise<undefined>>()
  .mockResolvedValue(undefined)
```

## Common Patterns

### AWS SDK Client Mocks
```typescript
vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: vi.fn<() => {send: Mock<() => Promise<{StatusCode: number}>>}>()
    .mockImplementation(() => ({
      send: vi.fn<() => Promise<{StatusCode: number}>>()
        .mockResolvedValue({StatusCode: 202})
    })),
  InvokeCommand: vi.fn()
}))
```

### Vendor Wrapper Mocks
```typescript
vi.mock('../../../lib/vendor/AWS/S3', () => ({
  headObject: vi.fn<() => Promise<{ContentLength: number; ETag: string}>>()
    .mockResolvedValue({ContentLength: 1024, ETag: '"abc123"'}),

  createS3Upload: vi.fn<() => Promise<{done: () => Promise<void>}>>()
    .mockResolvedValue({
      done: vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    })
}))
```

### NPM Package Mocks
```typescript
class MockYTDlpWrap {
  constructor(public binaryPath: string) {}

  getVideoInfo = vi.fn<() => Promise<{
    id: string
    title: string
    formats: Array<{format_id: string}>
  }>>().mockResolvedValue({
    id: 'video-123',
    title: 'Test',
    formats: [{format_id: 'best'}]
  })
}

vi.mock('yt-dlp-wrap', () => ({
  default: MockYTDlpWrap
}))
```

### Node Built-in Mocks
```typescript
vi.mock('fs/promises', () => ({
  copyFile: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  readFile: vi.fn<() => Promise<Buffer>>(),
  writeFile: vi.fn<() => Promise<void>>()
}))
```

## Benefits

### 1. Type Safety
```typescript
const mockFn = vi.fn<() => Promise<{ContentLength: number}>>()
  .mockResolvedValue({ContentLength: 1024})

// This would be a TypeScript error:
// mockFn.mockResolvedValue({ContentLenght: 1024})  // Typo caught!
```

### 2. IntelliSense Support
Auto-completion shows available properties for mock return values.

### 3. Refactoring Safety
When return types change, TypeScript errors guide you to update all mocks.

### 4. Better Error Messages
Specific types provide exact property names in error messages vs no error with `any`.

## When to Use Each Pattern

### Use Specific Type When:
- Mock returns a value (`mockResolvedValue`, `mockReturnValue`)
- Function has well-defined return type
- Testing domain-specific types
- Mocking AWS SDK responses

### Omit Type When:
- Mock is simple callback
- TypeScript can infer from usage
- Mock doesn't return a value
- Testing side effects only

### Use Domain Type When:
- Type is defined in your codebase
- Type represents business domain
- Multiple mocks share same type

## Anti-Patterns

### Generic Unknown
```typescript
// ❌ WRONG
const mockFn = vi.fn<() => Promise<unknown>>()
  .mockResolvedValue({anything: 'goes'})

// ✅ CORRECT
const mockFn = vi.fn<() => Promise<{userId: string; status: string}>>()
  .mockResolvedValue({userId: '123', status: 'active'})
```

### Type Assertion
```typescript
// ❌ WRONG
const mockFn = vi.fn() as Mock<Promise<UserData>>

// ✅ CORRECT
const mockFn = vi.fn<() => Promise<UserData>>()
```

### Duplicate Type Definitions
```typescript
// ❌ WRONG - Duplicating types
const mock1 = vi.fn<() => Promise<{id: string; name: string}>>()
const mock2 = vi.fn<() => Promise<{id: string; name: string}>>()

// ✅ CORRECT - Reuse type
import type {UserInfo} from '../../../types/user'
const mock1 = vi.fn<() => Promise<UserInfo>>()
const mock2 = vi.fn<() => Promise<UserInfo>>()
```

## Migration Guide

### Step 1: Find Problematic Mocks
```bash
grep -r "vi.fn<.*unknown.*>" test/ --include="*.ts"
grep -r "vi.fn<.*any.*>" test/ --include="*.ts"
grep -r "as any" test/ --include="*.ts"
```

### Step 2: Determine Correct Type
```typescript
// Current (bad)
const mockFn = vi.fn() as any

// Find usage
mockFn.mockResolvedValue({id: '123', name: 'Test'})

// Update with inferred type
const mockFn = vi.fn<() => Promise<{id: string; name: string}>>()
```

### Step 3: Import Types if Needed
```typescript
import type {User} from '../../../types/user'

const getUserMock = vi.fn<() => Promise<User>>()
  .mockResolvedValue({
    id: '123',
    name: 'Test User',
    email: 'test@example.com'
  })
```

## Related Patterns
- [Vitest Mocking Strategy](Vitest-Mocking-Strategy.md) - When and what to mock
- [Coverage Philosophy](Coverage-Philosophy.md) - Testing principles
- [AWS SDK Encapsulation](../Conventions/Vendor-Encapsulation-Policy.md) - Mock wrappers not SDK
- [Type Definitions](../TypeScript/Type-Definitions.md) - Where to define types

---

*Use specific type annotations for mocks to maintain type safety. Avoid `any`, `unknown`, and type assertions. Let TypeScript help you write correct tests.*
