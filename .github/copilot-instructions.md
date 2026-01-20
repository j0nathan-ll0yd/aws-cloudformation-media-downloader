# GitHub Copilot Workspace Instructions

## Project Context

AWS Serverless media downloader service built with OpenTofu and TypeScript. Downloads media content (primarily YouTube videos) and integrates with a companion iOS app for offline playback.

**Full documentation**: Read `AGENTS.md` in the repository root.

## Critical Rules

### 1. Vendor Encapsulation (CRITICAL - Zero Tolerance)

Never import AWS SDK or other vendor libraries directly. Use the vendor wrappers:

```typescript
// WRONG
import {S3Client} from '@aws-sdk/client-s3'
import {drizzle} from 'drizzle-orm/postgres-js'

// RIGHT
import {getS3Client} from '#lib/vendor/AWS/S3'
import {getDb} from '#lib/vendor/Drizzle/client'
```

### 2. Entity Query Mocking (CRITICAL)

Mock query functions, not legacy entity modules:

```typescript
// WRONG
vi.mock('#entities/Users', () => ({...}))

// RIGHT
vi.mock('#entities/queries', () => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn()
}))
```

### 3. No AI Attribution (CRITICAL)

Never include in commits:
- Emojis
- "Claude", "AI", "Generated with", "Co-Authored-By"
- Any AI tool attribution

```bash
# RIGHT
git commit -m "feat: add user authentication"
```

### 4. Cascade Deletion Safety (CRITICAL)

```typescript
// WRONG - Partial failures leave orphaned data
await Promise.all([deleteUser(), deleteUserFiles()])

// RIGHT - Use Promise.allSettled, delete children first
await Promise.allSettled([deleteUserFiles(), deleteUserDevices()])
await deleteUser()
```

### 5. Response Helpers (HIGH)

```typescript
// WRONG
return {statusCode: 200, body: JSON.stringify(data)}

// RIGHT
import {response} from '#util/response'
return response(200, data)
```

## Code Generation Guidelines

### Lambda Handler Pattern

```typescript
import {Tracer} from '@aws-lambda-powertools/tracer'
import {createAuthenticatedHandler} from '#util/createAuthenticatedHandler'
import {response} from '#util/response'
import {ResponseStatus} from '#types/enums'

const tracer = new Tracer()

export const handler = createAuthenticatedHandler(async (event, userId) => {
  // Handler implementation
  return response(200, {status: ResponseStatus.Success})
})
```

### Test File Pattern

```typescript
import {describe, it, expect, vi, beforeEach} from 'vitest'
import type {Mock} from 'vitest'

// Mock dependencies BEFORE imports
vi.mock('#entities/queries', () => ({
  getUser: vi.fn(),
  getUserFiles: vi.fn()
}))

vi.mock('#lib/vendor/AWS/S3', () => ({
  getS3Client: vi.fn()
}))

import {handler} from '../src/index'
import {getUser} from '#entities/queries'

describe('LambdaName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle success case', async () => {
    ;(getUser as Mock).mockResolvedValue({userId: 'test-user'})

    const result = await handler(mockEvent)

    expect(result.statusCode).toBe(200)
  })
})
```

### Entity Query Pattern

```typescript
// Use prepared statements for performance-critical queries
import {getUserById} from '#entities/queries'

const user = await getUserById(userId)
```

## Key Resources

| Resource | Path |
|----------|------|
| Full Context | `AGENTS.md` |
| Active Conventions | `docs/wiki/Meta/Conventions-Tracking.md` |
| Dependencies | `build/graph.json` |
| Lambda Patterns | `docs/wiki/TypeScript/Lambda-Function-Patterns.md` |
| Testing Guide | `docs/wiki/Testing/Vitest-Mocking-Strategy.md` |
| Vendor Policy | `docs/wiki/Conventions/Vendor-Encapsulation-Policy.md` |

## Pre-Commit Checklist

1. `pnpm run validate:conventions` - Check convention compliance
2. `pnpm run precheck` - TypeScript type checking and lint
3. `pnpm run format` - Auto-format with dprint
4. `pnpm run test` - Run unit tests
5. No AI references in commit message

## Don't

- Import `@aws-sdk/*` directly
- Import `drizzle-orm` directly
- Use `vi.mock('#entities/Users')` pattern
- Use underscore-prefixed unused variables
- Add AI attribution to commits
- Use `Promise.all` for cascade deletions
- Return raw `{statusCode, body}` objects
- Call `getRequiredEnv()` at module level (call inside functions)
