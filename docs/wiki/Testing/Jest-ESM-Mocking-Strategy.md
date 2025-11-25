# Jest ESM Mocking Strategy

## Quick Reference
- **When to use**: Writing unit tests with ES modules
- **Enforcement**: Required
- **Impact if violated**: HIGH - Obscure test failures

## The Problem

In ES modules, **ALL module-level code executes when ANY export is imported**. Missing mocks for transitive dependencies cause mysterious 500 errors.

```typescript
// YouTube.ts
import YTDlpWrap from 'yt-dlp-wrap'  // Executes even if unused
import {spawn} from 'child_process'  // Executes

export function getVideoID(url: string) { }  // What you imported
export function streamVideoToS3() { }        // Uses the above imports
```

When testing `getVideoID`, all imports execute. Solution: Mock ALL transitive dependencies.

## Mocking Pattern

```typescript
// test/index.test.ts

// 1. Mock ALL transitive dependencies BEFORE imports
jest.unstable_mockModule('yt-dlp-wrap', () => ({
  default: jest.fn()
}))

jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn()
}))

jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({
  createS3Upload: jest.fn()
}))

// 2. Import after mocking
const {handler} = await import('../src/index')

// 3. Use type assertions for mocks
import type {jest as mockJest} from '@jest/globals'
const mockYTDlp = (await import('yt-dlp-wrap')).default as mockJest.MockedFunction<any>
```

## Dependency Mapping

1. **Map direct imports** - What does your test file import?
2. **Map transitive imports** - What do those imports import?
3. **Mock all external deps** - AWS SDK, npm packages, vendor wrappers
4. **Match module structure** - Classes need constructor mocks

## Common Patterns

### AWS SDK Mocks
```typescript
jest.unstable_mockModule('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({
    send: jest.fn()
  }))
}))
```

### Vendor Wrapper Mocks
```typescript
jest.unstable_mockModule('../../../lib/vendor/AWS/DynamoDB', () => ({
  getDynamoDbClient: jest.fn(),
  queryItems: jest.fn()
}))
```

### ElectroDB Mock Helper
```typescript
// Always use the helper for ElectroDB
jest.unstable_mockModule('../../../entities/Files', () =>
  createElectroDBMock('Files')
)
```

## Testing Checklist

- [ ] List all imports in test file
- [ ] Read source files, list their imports
- [ ] Mock ALL external dependencies
- [ ] Mock BEFORE importing handler
- [ ] Add TypeScript types to mocks
- [ ] Test locally AND in CI

## Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| Cannot find module | Missing mock | Add jest.unstable_mockModule |
| X is not a constructor | Wrong mock structure | Mock as class with constructor |
| Property X doesn't exist | Incomplete mock | Add missing properties |
| Works locally, fails CI | Environment differences | Mock all transitive deps |

## Best Practices

1. **Mock first, import second** - Always mock before importing
2. **Mock everything external** - All npm packages and AWS SDK
3. **Use type assertions** - Add proper types to mocks
4. **Use mock helpers** - ElectroDB mock helper for entities
5. **Map dependencies** - Trace all transitive imports

## Related Patterns

- [Mock Type Annotations](Mock-Type-Annotations.md) - TypeScript mock patterns
- [Lazy Initialization](Lazy-Initialization-Pattern.md) - Defer module execution
- [Coverage Philosophy](Coverage-Philosophy.md) - Test strategy

---

*Mock ALL transitive dependencies in ES modules to prevent obscure test failures.*